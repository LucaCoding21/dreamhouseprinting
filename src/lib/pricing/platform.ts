import { roundCents } from "@/lib/money";
import type { ProductRow, DecorationMethodRow } from "@/lib/db/rows";

/**
 * Platform cost-plus engine (PRD §10.3) — now the FALLBACK, not the primary.
 * Customer pricing lives in the per-product quantity-break curve
 * (products.pricing_rules.quote, priced by lib/pricing/quote.ts); this engine
 * only prices products without a curve, and supplies garment retail as the
 * curve-less "from" price plus internal cost/margin info for admin.
 * The price shown at submit is snapshotted onto the Design/Order so a later
 * catalog change can't retroactively alter a placed order.
 *
 *   garment retail  = base_price override, else wholesale_cost + markup
 *   decoration/unit = (per_unit_cost + per_color_cost × colours) × locations
 *   setup           = setup_fee × locations (one-time, per screen/location)
 *   unit price      = garment retail + decoration/unit, less any bulk-tier discount
 *   line total      = unit price × qty
 *   order total     = line total + setup  (+ shipping + tax, added at checkout)
 *
 * Bulk tiers live on product.pricing_rules.bulkTiers: [{minQty, discountPct}].
 */

export interface PricingInput {
  product: Pick<ProductRow, "wholesale_cost" | "base_price" | "markup_type" | "markup_value" | "pricing_rules">;
  method?: Pick<DecorationMethodRow, "setup_fee" | "per_unit_cost" | "per_color_cost"> | null;
  quantity: number;
  colourCount?: number;   // ink colours (screenprint); ignored when method has no per_color_cost
  locationCount?: number; // number of print locations/areas used
}

export interface PriceBreakdown {
  garmentRetail: number;     // per-unit garment retail (after markup)
  decorationPerUnit: number; // per-unit decoration cost
  unitPrice: number;         // garment + decoration, after bulk discount
  quantity: number;
  bulkDiscountPct: number;
  setupTotal: number;        // one-time setup fees
  subtotal: number;          // unitPrice × qty
  total: number;             // subtotal + setup (pre shipping/tax)
}

interface BulkTier {
  minQty: number;
  discountPct: number;
}

export function garmentRetailUnit(
  product: PricingInput["product"]
): number {
  if (product.base_price && product.base_price > 0) return roundCents(product.base_price);
  const cost = product.wholesale_cost ?? 0;
  const markup = product.markup_value ?? 0;
  const retail = product.markup_type === "flat" ? cost + markup : cost * (1 + markup / 100);
  return roundCents(retail);
}

function bulkDiscountPct(product: PricingInput["product"], quantity: number): number {
  const rules = (product.pricing_rules ?? {}) as { bulkTiers?: BulkTier[] };
  const tiers = rules.bulkTiers ?? [];
  let pct = 0;
  for (const t of tiers) {
    if (quantity >= t.minQty && t.discountPct > pct) pct = t.discountPct;
  }
  return pct;
}

export function calcPrice(input: PricingInput): PriceBreakdown {
  const { product, method, quantity } = input;
  const locations = Math.max(1, input.locationCount ?? 1);
  const colours = Math.max(0, input.colourCount ?? 0);

  const garmentRetail = garmentRetailUnit(product);

  const perUnitDeco = method
    ? (method.per_unit_cost ?? 0) + (method.per_color_cost ?? 0) * colours
    : 0;
  const decorationPerUnit = roundCents(perUnitDeco * locations);
  const setupTotal = roundCents((method?.setup_fee ?? 0) * locations);

  const pct = bulkDiscountPct(product, quantity);
  const baseUnit = garmentRetail + decorationPerUnit;
  const unitPrice = roundCents(baseUnit * (1 - pct / 100));

  const subtotal = roundCents(unitPrice * quantity);
  const total = roundCents(subtotal + setupTotal);

  return {
    garmentRetail,
    decorationPerUnit,
    unitPrice,
    quantity,
    bulkDiscountPct: pct,
    setupTotal,
    subtotal,
    total,
  };
}
