import { roundCents } from "@/lib/money";
import type { ProductRow } from "@/lib/db/rows";

/**
 * Garment retail: the blank's price after markup.
 *
 *   garment retail = base_price override, else wholesale_cost + markup
 *
 * This was once a full cost-plus pricing engine (PRD §10.3) that priced any
 * product lacking a quantity-break curve. It was never calibrated against
 * Julian's real list, so it quoted a single tee at $9.88 against a true $66.25,
 * and it only ever ran on unconfigured products. Products are now given a price
 * list at import and cannot go live without one, so the fallback had no reachable
 * job left and was removed rather than left as a loaded gun. What remains is the
 * markup helper, which the curve compiler and admin margin display still need.
 */

export interface PricingInput {
  product: Pick<ProductRow, "wholesale_cost" | "base_price" | "markup_type" | "markup_value" | "pricing_rules">;
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


