import { roundCents } from "@/lib/money";

export type DiscountType = "amount" | "percent";

export interface DiscountConfig {
  discountType?: DiscountType;
  /** Raw input: a dollar amount when type is "amount", a 0–100 percent when "percent". */
  discountValue?: number;
}

/**
 * Resolve a discount to a dollar figure against the pre-tax goods total
 * (subtotal + setup + rush + add-ons). Never exceeds `goods` and never goes
 * negative. Percentages are clamped to 0–100.
 */
export function resolveDiscount(goods: number, cfg: DiscountConfig): number {
  const value = Number(cfg.discountValue) || 0;
  if (value <= 0 || goods <= 0) return 0;
  const raw = cfg.discountType === "percent" ? goods * (Math.min(value, 100) / 100) : value;
  return roundCents(Math.min(Math.max(raw, 0), goods));
}
