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
 * Pure module (no server imports): read by the designer, cart, product-page
 * estimate, shop grid and quick quote on the client, and enforced by
 * placeOrderAction + /api/submit on the server. Change the number here and
 * every surface follows.
 */
export const MIN_ONLINE_ORDER_QTY = 20;

export function piecesShortOfMinimum(qty: number): number {
  return Math.max(0, MIN_ONLINE_ORDER_QTY - Math.max(0, Math.floor(qty)));
}

/** Customer-facing reason an order can't go through at this quantity. */
export function minimumOrderMessage(qty: number): string {
  const short = piecesShortOfMinimum(qty);
  return `Our minimum order is ${MIN_ONLINE_ORDER_QTY} pieces. Add ${short} more ${short === 1 ? "piece" : "pieces"} to continue.`;
}
