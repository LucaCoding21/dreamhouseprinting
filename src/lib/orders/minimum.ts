/**
 * Minimum piece count for anything a CUSTOMER submits: designer -> cart ->
 * order, and the home-page quick quote (which is also what "by email" gets
 * pointed at).
 *
 * Julian's production can't absorb a stream of small runs, so every customer
 * request has to be at least this many pieces, counted across every colourway
 * of one design (the same combined quantity the price curve is applied to).
 * Admin manual orders (/admin/orders/new) are deliberately NOT gated, so a
 * smaller job Julian chooses to take can still be keyed in by hand.
 *
 * The number itself is Julian's to set: Admin -> Settings -> Checkout
 * ("Minimum order"), stored as `minimumOrderQty` on the "business" settings
 * row. 0 means no minimum. The server reads it via getMinimumOrderQty()
 * (lib/orders/minimumServer.ts); client components get it from
 * useMinimumOrder() (MinimumOrderContext, mounted in the root layout).
 *
 * Pure module (no server imports): the helpers below take the minimum as an
 * argument so client and server share one wording.
 */
export const DEFAULT_MIN_ONLINE_ORDER_QTY = 20;
export const MAX_MIN_ONLINE_ORDER_QTY = 1000;

/** Clamp a stored/typed minimum to a sane whole number (0 = no minimum). */
export function normalizeMinimum(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_MIN_ONLINE_ORDER_QTY;
  return Math.min(MAX_MIN_ONLINE_ORDER_QTY, Math.max(0, Math.floor(n)));
}

/** True when there is a minimum worth telling the customer about. */
export function hasMinimum(min: number): boolean {
  return min > 1;
}

/** The lowest quantity a customer-facing quantity control should allow. */
export function qtyFloor(min: number): number {
  return Math.max(1, min);
}

/** Quantity preset chips: the minimum first (when there is one), then the
 *  usual round numbers above it. */
export function quantityPresets(min: number, base: number[]): number[] {
  const floor = qtyFloor(min);
  const above = base.filter((n) => n > floor);
  return hasMinimum(min) || base.includes(floor) ? [floor, ...above] : above;
}

export function piecesShortOfMinimum(qty: number, min: number): number {
  return Math.max(0, min - Math.max(0, Math.floor(qty)));
}

export function isUnderMinimum(qty: number, min: number): boolean {
  return piecesShortOfMinimum(qty, min) > 0;
}

/** Customer-facing reason an order can't go through at this quantity. */
export function minimumOrderMessage(qty: number, min: number): string {
  const short = piecesShortOfMinimum(qty, min);
  return `Our minimum order is ${min} pieces. Add ${short} more ${short === 1 ? "piece" : "pieces"} to continue.`;
}
