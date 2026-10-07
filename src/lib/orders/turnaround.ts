/**
 * When will an order be ready? Pure and client-safe: the customer order page,
 * the admin order detail and the server clock all read the same rules here.
 *
 * Julian's rule: a standard order is ready 8-12 business days after the
 * customer approves the proof AND pays. The count starts at that moment, not at
 * placement, because customers sometimes sit on a proof for days and the shop
 * can't start printing before both have happened. So an order carries:
 *
 *   orders.turnaround           how the date is decided (business days, or a fixed date)
 *   orders.production_clock_at  when the count started (approved + paid, or into production)
 *   orders.due_date             the date itself; for business-day orders it is
 *                               stamped from the clock so the admin list can sort on it
 *
 * Dates are plain YYYY-MM-DD in the shop's timezone (Vancouver). Doing the
 * business-day math on date strings rather than Date objects keeps a server in
 * UTC from landing a day off after 5pm Pacific. Weekends are skipped; statutory
 * holidays are not (Julian adjusts by hand when one falls inside a window).
 */
import type { DecorationPricingSettings } from "@/lib/pricing/decorationPricing";

export type Turnaround =
  | { kind: "days"; min: number; max: number }
  | { kind: "date"; requested?: boolean };

export interface StandardWindow {
  min: number;
  max: number;
}

/** The shop's standard window from the decoration pricing settings. */
export function standardWindowFrom(settings: Pick<DecorationPricingSettings, "standardMinDays" | "standardDays">): StandardWindow {
  return { min: settings.standardMinDays, max: settings.standardDays };
}

export const SHOP_TIME_ZONE = "America/Vancouver";

/** Upper bound for a typed business-day count, keeps a typo from scheduling next year. */
export const MAX_TURNAROUND_DAYS = 60;

/* ------------------------------- parsing ------------------------------- */

function wholeDays(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 1 && r <= MAX_TURNAROUND_DAYS ? r : null;
}

/** A stored turnaround blob, or null when it is missing or malformed. */
export function parseTurnaround(raw: unknown): Turnaround | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (v.kind === "date") return v.requested === true ? { kind: "date", requested: true } : { kind: "date" };
  if (v.kind === "days") {
    const min = wholeDays(v.min);
    const max = wholeDays(v.max);
    if (min == null || max == null) return null;
    return { kind: "days", min: Math.min(min, max), max: Math.max(min, max) };
  }
  return null;
}

/** Build a business-day turnaround from typed values, repairing the order of the ends. */
export function daysTurnaround(min: number, max: number): Turnaround | null {
  return parseTurnaround({ kind: "days", min, max });
}

/**
 * The turnaround an order actually runs on. Rows from before turnaround existed
 * (or written while the column was missing) fall back to: their due_date when
 * one is set, otherwise the shop's standard window.
 */
export function resolveTurnaround(raw: unknown, dueDate: string | null, standard: StandardWindow): Turnaround {
  const parsed = parseTurnaround(raw);
  // A date turnaround without a date has nothing to show; run on the standard window.
  if (parsed && (parsed.kind === "days" || dueDate)) return parsed;
  if (!parsed && dueDate) return { kind: "date" };
  return { kind: "days", min: standard.min, max: standard.max };
}

/* ------------------------------- dates ------------------------------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && ISO_DATE.test(s);
}

/** The calendar date of an instant in the shop's timezone, as YYYY-MM-DD. */
export function shopDateOf(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  // en-CA formats as YYYY-MM-DD.
  return d.toLocaleDateString("en-CA", { timeZone: SHOP_TIME_ZONE });
}

export function shopToday(): string {
  return shopDateOf(new Date());
}

/** `iso` plus n business days (weekends skipped). Day 0 is `iso` itself. */
export function addBusinessDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  let added = 0;
  while (added < n) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date.toISOString().slice(0, 10);
}

/** The ready window for a count that started on `startIso`. */
export function readyWindow(startIso: string, t: { min: number; max: number }): { from: string; to: string } {
  return { from: addBusinessDaysIso(startIso, t.min), to: addBusinessDaysIso(startIso, t.max) };
}

/** "Tue, Oct 20" (the year only when it isn't this year). */
export function fmtReadyDay(iso: string, opts: { weekday?: boolean } = {}): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const thisYear = Number(shopToday().slice(0, 4));
  return date.toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: opts.weekday === false ? undefined : "short",
    month: "short",
    day: "numeric",
    year: y === thisYear ? undefined : "numeric",
  });
}

/** "8-12 business days", or "5 business days" when both ends match. */
export function fmtDaysRange(t: { min: number; max: number }): string {
  const n = t.min === t.max ? `${t.max}` : `${t.min}-${t.max}`;
  return `${n} business day${t.min === t.max && t.max === 1 ? "" : "s"}`;
}

/* ------------------------------- the clock ------------------------------- */

const APPROVED_OR_LATER = new Set<string>([
  "approved",
  "in_production",
  "quality_check",
  "shipped",
  "ready_for_pickup",
  "completed",
]);

const PRODUCTION_OR_LATER = new Set<string>([
  "in_production",
  "quality_check",
  "shipped",
  "ready_for_pickup",
  "completed",
]);

/** Statuses before the customer has approved anything. */
export const PRE_APPROVAL_STATUSES = new Set<string>(["draft", "submitted", "in_review", "proof_ready", "changes_requested"]);

/**
 * Should the count be running? Approved AND paid starts it. So does Julian
 * moving the order into production without a payment on file (pay at pickup,
 * a trusted repeat customer): production has begun, so the clock has too.
 */
export function clockShouldRun(status: string, paidAt: string | null): boolean {
  if (PRODUCTION_OR_LATER.has(status)) return true;
  return APPROVED_OR_LATER.has(status) && !!paidAt;
}

/* ------------------------------- customer view ------------------------------- */

/** What the customer has left to do before the count starts. */
export type ReadyAsk = "approve_and_pay" | "approve" | "pay";

export type ReadyBy =
  /** Business days, count not started yet. `projected` = the window if they act today. */
  | { state: "waiting"; min: number; max: number; ask: ReadyAsk | null; projected: { from: string; to: string } | null }
  /** Business days, counting. Dates are null only for a legacy row whose start was never recorded. */
  | { state: "running"; min: number; max: number; startedOn: string | null; from: string | null; to: string | null }
  /** A fixed date. `requested` = the customer's ask, not yet confirmed by the shop. */
  | { state: "date"; date: string; requested: boolean };

const NO_ESTIMATE = new Set<string>(["draft", "on_hold", "cancelled", "shipped", "ready_for_pickup", "completed"]);

/**
 * The customer-facing ready estimate for an order, or null when there is
 * nothing to promise (finished, cancelled, on hold).
 */
export function readyByFor(
  order: {
    status: string;
    paid_at: string | null;
    due_date: string | null;
    turnaround?: unknown;
    production_clock_at?: string | null;
  },
  standard: StandardWindow,
  today: string = shopToday(),
): ReadyBy | null {
  if (NO_ESTIMATE.has(order.status)) return null;
  const t = resolveTurnaround(order.turnaround ?? null, order.due_date, standard);
  const clockAt = order.production_clock_at ?? null;

  if (t.kind === "date") {
    // resolveTurnaround only returns "date" when due_date is set.
    return { state: "date", date: order.due_date!, requested: !!t.requested && !clockAt };
  }

  if (clockAt) {
    const startedOn = shopDateOf(clockAt);
    const w = readyWindow(startedOn, t);
    return { state: "running", min: t.min, max: t.max, startedOn, from: w.from, to: w.to };
  }
  if (clockShouldRun(order.status, order.paid_at)) {
    // Legacy: counting, but the start was never recorded. Say the rule, no dates.
    return { state: "running", min: t.min, max: t.max, startedOn: null, from: null, to: null };
  }

  const paid = !!order.paid_at;
  const ask: ReadyAsk | null =
    order.status === "proof_ready"
      ? paid
        ? "approve"
        : "approve_and_pay"
      : order.status === "approved" && !paid
        ? "pay"
        : null;
  return { state: "waiting", min: t.min, max: t.max, ask, projected: ask ? readyWindow(today, t) : null };
}

/**
 * The ready estimate as one plain sentence, for emails ({{readyBy}}) where the
 * card layout of the order page isn't available.
 */
export function readyBySentence(ready: ReadyBy): string {
  if (ready.state === "date") {
    return ready.requested
      ? `You asked for it by ${fmtReadyDay(ready.date)}. We'll confirm the date with your proof.`
      : `Your order will be ready by ${fmtReadyDay(ready.date)}.`;
  }
  const range = fmtDaysRange(ready);
  if (ready.state === "running") {
    if (!ready.from || !ready.to) return `Your order will be ready ${range} from approval and payment.`;
    return ready.min === ready.max
      ? `Your order will be ready by ${fmtReadyDay(ready.to)}.`
      : `Your order will be ready between ${fmtReadyDay(ready.from)} and ${fmtReadyDay(ready.to)}.`;
  }
  return `Your order will be ready ${range} after approval and payment.`;
}
