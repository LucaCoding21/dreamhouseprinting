/**
 * Date helpers for the legacy single-design checkout review timeline. The ready
 * date customers are promised everywhere else (designer, cart, order page,
 * emails) comes from lib/orders/turnaround.ts.
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
