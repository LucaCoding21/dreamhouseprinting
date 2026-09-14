/**
 * Minimum piece count for SELF-SERVE online orders (designer -> cart -> order).
 *
 * Julian's production can't absorb a stream of small runs, so anything the
 * customer submits on their own has to be at least this many pieces, counted
 * across every colourway of one design (the same combined quantity the price
 * curve is applied to). Smaller jobs are still welcome, they just go through a
 * human: the home-page quick quote or an email, where Julian decides case by
 * case. Admin manual orders (/admin/orders/new) are deliberately NOT gated.
 *
 * Pure module (no server imports): read by the designer, cart, product-page
 * estimate and shop grid on the client, and enforced by placeOrderAction on
 * the server. Change the number here and every surface follows.
 */
export const MIN_ONLINE_ORDER_QTY = 20;

/** Where to send customers who genuinely need fewer than the minimum. */
export const SMALL_ORDER_HELP_HREF = "/#quick-quote";

export function piecesShortOfMinimum(qty: number): number {
  return Math.max(0, MIN_ONLINE_ORDER_QTY - Math.max(0, Math.floor(qty)));
}

/** Customer-facing reason an online order can't go through at this quantity. */
export function minimumOrderMessage(qty: number): string {
  const short = piecesShortOfMinimum(qty);
  return `Online orders start at ${MIN_ONLINE_ORDER_QTY} pieces. Add ${short} more ${short === 1 ? "piece" : "pieces"}, or get a quick quote for a smaller run.`;
}
