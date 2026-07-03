import {
  priceAtQty,
  EXTRA_COLOUR_SURCHARGE,
  EXTRA_LOCATION_SURCHARGE,
  MAX_LOCATIONS,
} from "@/lib/pricing";
import type {
  ProductQuoteCurveJson,
  QuoteDecoration,
} from "@/lib/db/rows";

/**
 * Storefront Detailed Quote pricing (product page only). Mirrors
 * `calculateQuote` in lib/pricing.ts exactly, but reads a per-product curve
 * stored on `products.pricing_rules.quote` instead of the hardcoded tables —
 * so admins can tune each product's price/tiers and the quote follows.
 *
 *   per-unit = base price at qty (incl. 1 decoration + 1 location)
 *            + screen colour surcharge (screen only)
 *            + extra-location surcharge × (locations − 1)
 *
 * The platform engine (lib/pricing/platform.ts) is deliberately NOT used here —
 * it can't reproduce these numbers — and is left untouched for the designer.
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
export function startingFromCurve(curve: ProductQuoteCurveJson): number {
  let best = Infinity;
  for (const d of curve.decorations) {
    const breaks = curve.breaks[d];
    if (!breaks?.length) continue;
    const cheapest = breaks.reduce((m, b) => Math.min(m, b.price), Infinity);
    best = Math.min(best, cheapest);
  }
  return Number.isFinite(best) ? best : 0;
}
