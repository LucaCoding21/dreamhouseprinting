/**
 * Rush turnaround surcharge. A flat 50% fee on the pre-tax job price
 * (goods subtotal + setup fees) applied when the customer picks the rush /
 * ASAP turnaround. Pure module, safe to import on the client (checkout
 * summaries) and the server (order placement). Keep this the single source of
 * the rush formula so every surface charges the same amount.
 */
import { roundCents } from "@/lib/money";

/** Fraction of the pre-tax job price charged for a rush turnaround. */
export const RUSH_RATE = 0.5;

/**
 * Flat rush surcharge: 50% of (subtotal + setup), rounded to whole cents.
 * Returns 0 when `isRush` is false so callers can pass it through unconditionally.
 */
export function rushFee(subtotal: number, setup: number, isRush: boolean): number {
  if (!isRush) return 0;
  return roundCents((subtotal + setup) * RUSH_RATE);
}
