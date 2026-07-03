/**
 * Shared turnaround math. The designer review screen and the checkout review
 * screen both project delivery dates from a product's printing lead time — they
 * MUST use the same helpers or a customer sees one date in the designer and a
 * different one at checkout minutes later. Keep this the single source.
 */

/** Skip weekends so projected dates land on business days. */
export function addBusinessDays(date: Date, n: number): Date {
  const d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Estimated in-hands window for an order placed today, given the product's
 * printing lead time. Mirrors the checkout review timeline (ship in lead+1..+3
 * business days, then +2..+4 transit) so both screens agree.
 */
export function inHandsWindow(today: Date, leadTimeDays: number): { start: Date; end: Date } {
  const lead = Math.max(1, leadTimeDays || 10);
  const shipStart = addBusinessDays(today, lead + 1);
  const shipEnd = addBusinessDays(today, lead + 3);
  return { start: addBusinessDays(shipStart, 2), end: addBusinessDays(shipEnd, 4) };
}
