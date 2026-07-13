import {
  priceAtQty,
  EXTRA_COLOUR_SURCHARGE,
  EXTRA_LOCATION_SURCHARGE,
  MAX_LOCATIONS,
} from "@/lib/pricing";
import { garmentRetailUnit, type PricingInput } from "@/lib/pricing/platform";
import type {
  ProductQuoteCurveJson,
  QuoteDecoration,
} from "@/lib/db/rows";

/**
 * THE customer pricing engine. Mirrors `calculateQuote` in lib/pricing.ts
 * exactly, but reads a per-product curve stored on
 * `products.pricing_rules.quote` instead of the hardcoded tables — so admins
 * can tune each product's price/tiers and every surface follows.
 *
 *   per-unit = base price at qty (incl. 1 decoration + 1 location)
 *            + screen colour surcharge (screen only)
 *            + extra-location surcharge × (locations − 1)
 *
 * Curve prices are ALL-INCLUSIVE (garment + decoration + amortized setup), so
 * curve-priced jobs carry no separate setup fee. The shop card, product-page
 * estimate, designer, cart and order snapshot all price here; the platform
 * cost-plus engine (lib/pricing/platform.ts) survives only as the fallback for
 * products without a curve and as internal cost/margin info for admin.
 */

export { MAX_LOCATIONS };

/**
 * Reference quantity the "volume discount" is measured against (the strikethrough
 * "before" price). Anchoring to a small-batch order — not a single unit — keeps
 * the discount believable and makes it *grow* with quantity (0% at small orders,
 * climbing as you scale), which is the whole point of the panel. The per-unit
 * price itself is unaffected; this only drives the badge + strikethrough.
 */
export const ANCHOR_QTY = 12;

export interface QuoteInput {
  qty: number;
  colours: number;
  locations: number;
  decoration: QuoteDecoration;
}

export interface QuoteResult {
  /** Final per-unit price at this quantity/config. */
  perUnit: number;
  /** perUnit × qty. */
  total: number;
  /** Per-unit price at qty 1 (the strikethrough "before" price). */
  anchorPerUnit: number;
  /** Whole-percent volume discount vs the qty-1 anchor (0 when none). */
  discountPct: number;
  /** Whether this decoration is actually priceable for the product. */
  available: boolean;
}

/** Resolve the curve's default decoration if the requested one isn't offered. */
export function defaultDecoration(curve: ProductQuoteCurveJson): QuoteDecoration {
  return curve.decorations[0] ?? "screen";
}

export function priceFromCurve(
  curve: ProductQuoteCurveJson,
  input: QuoteInput
): QuoteResult {
  const { qty, colours, locations, decoration } = input;
  const breaks = curve.breaks[decoration];
  if (!breaks || breaks.length === 0 || qty <= 0) {
    return { perUnit: 0, total: 0, anchorPerUnit: 0, discountPct: 0, available: false };
  }
  const rows = breaks.map((b) => [b.minQty, b.price] as [number, number]);

  const perUnitAt = (q: number) => {
    const base = priceAtQty(rows, q);
    const colourSurcharge =
      decoration === "screen"
        ? EXTRA_COLOUR_SURCHARGE[Math.min(Math.max(colours, 1), 5)] ?? 0
        : 0;
    const extraLocations = Math.max(0, Math.min(locations, MAX_LOCATIONS) - 1);
    const locationSurcharge =
      extraLocations > 0
        ? extraLocations * priceAtQty(EXTRA_LOCATION_SURCHARGE[decoration], q)
        : 0;
    return base + colourSurcharge + locationSurcharge;
  };

  const perUnit = perUnitAt(qty);
  const anchorPerUnit = perUnitAt(ANCHOR_QTY);
  const discountPct =
    anchorPerUnit > 0 && perUnit < anchorPerUnit
      ? Math.round((1 - perUnit / anchorPerUnit) * 100)
      : 0;

  return {
    perUnit,
    total: perUnit * qty,
    anchorPerUnit,
    discountPct,
    available: true,
  };
}

/** Lowest "from $X/unit" price across this product's decorations at high volume. */
export function startingFromCurve(
  curve: ProductQuoteCurveJson,
  decorations: QuoteDecoration[] = curve.decorations
): number {
  let best = Infinity;
  for (const d of decorations) {
    const breaks = curve.breaks[d];
    if (!breaks?.length) continue;
    const cheapest = breaks.reduce((m, b) => Math.min(m, b.price), Infinity);
    best = Math.min(best, cheapest);
  }
  return Number.isFinite(best) ? best : 0;
}

/** Pull the customer price curve off a product row, if it has one. */
export function curveForProduct(
  product: Pick<PricingInput["product"], "pricing_rules">
): ProductQuoteCurveJson | null {
  const rules = (product.pricing_rules ?? {}) as { quote?: ProductQuoteCurveJson };
  const curve = rules.quote;
  if (!curve?.decorations?.length) return null;
  const hasPrices = curve.decorations.some((d) => (curve.breaks[d] ?? []).length > 0);
  return hasPrices ? curve : null;
}

/**
 * Map a decoration_methods slug onto the curve's decoration axis. Methods the
 * curve can't price (DTG, vinyl) return null and fall back to the platform
 * cost-plus engine.
 */
export function decorationForMethodSlug(slug: string | null | undefined): QuoteDecoration | null {
  if (slug === "screenprint") return "screen";
  if (slug === "embroidery") return "embroidery";
  return null;
}

/**
 * Curve decorations the customer may actually pick for a product: the curve's
 * axes intersected with the admin-enabled decoration methods
 * (products.allowed_decoration_method_ids, resolved to slugs). An empty
 * intersection falls back to the full curve so a misconfigured product still
 * quotes a price; the admin product editor warns about that state.
 */
export function allowedCurveDecorations(
  curve: ProductQuoteCurveJson,
  allowedMethodSlugs: string[] | null | undefined
): QuoteDecoration[] {
  if (!allowedMethodSlugs) return curve.decorations;
  const axes = new Set(
    allowedMethodSlugs
      .map((s) => decorationForMethodSlug(s))
      .filter((d): d is QuoteDecoration => d !== null)
  );
  const offered = curve.decorations.filter((d) => axes.has(d));
  return offered.length > 0 ? offered : curve.decorations;
}

/**
 * Catalog price line for the shop card / product page / price sorting. Curve
 * products advertise their best decorated per-unit price ("as low as $8.09");
 * curve-less products fall back to the blank garment retail ("from $X").
 */
export function shopPrice(product: PricingInput["product"]): {
  amount: number;
  label: "as low as" | "from";
} {
  const curve = curveForProduct(product);
  if (curve) return { amount: startingFromCurve(curve), label: "as low as" };
  return { amount: garmentRetailUnit(product), label: "from" };
}

/**
 * Next quantity break above `qty` for the designer's "add N more" nudge:
 * how many more units until the per-unit price drops, and to what.
 */
export function nextCurveBreak(
  curve: ProductQuoteCurveJson,
  input: QuoteInput
): { add: number; perUnit: number; savePct: number } | null {
  const breaks = curve.breaks[input.decoration];
  if (!breaks?.length || input.qty <= 0) return null;
  const current = priceFromCurve(curve, input);
  if (!current.available) return null;
  const next = [...breaks]
    .sort((a, b) => a.minQty - b.minQty)
    .find((b) => b.minQty > input.qty);
  if (!next) return null;
  const at = priceFromCurve(curve, { ...input, qty: next.minQty });
  if (!at.available || at.perUnit >= current.perUnit) return null;
  const savePct = Math.round((1 - at.perUnit / current.perUnit) * 100);
  if (savePct <= 0) return null;
  return { add: next.minQty - input.qty, perUnit: at.perUnit, savePct };
}
