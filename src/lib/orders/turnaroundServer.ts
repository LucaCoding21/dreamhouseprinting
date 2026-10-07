import "server-only";

import type { Json, Database } from "@/lib/db/types";
import type { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { DECORATION_PRICING_SETTINGS_KEY, mergeDecorationPricing } from "@/lib/pricing/decorationPricing";
import {
  PRE_APPROVAL_STATUSES,
  clockShouldRun,
  fmtDaysRange,
  fmtReadyDay,
  readyByFor,
  readyWindow,
  resolveTurnaround,
  shopDateOf,
  standardWindowFrom,
  type ReadyBy,
  type StandardWindow,
  type Turnaround,
} from "./turnaround";

/**
 * The server half of lib/orders/turnaround.ts: reading the shop's standard
 * window, writing an order's turnaround, and starting (or resetting) the
 * business-day count when the order's status or payment moves.
 *
 * Every function here tolerates a database without migration 0017 (the
 * turnaround columns): reads fall back to "no turnaround recorded" and writes
 * report failure instead of throwing, so placing, approving and paying for an
 * order never break over the ready date.
 */

type Service = ReturnType<typeof requireSupabaseServiceClient>;
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];
const asJson = (v: unknown) => v as unknown as Json;

export async function loadStandardWindow(service: Service): Promise<StandardWindow> {
  const { data } = await service.from("settings").select("value").eq("key", DECORATION_PRICING_SETTINGS_KEY).maybeSingle();
  return standardWindowFrom(mergeDecorationPricing(data?.value));
}

/** The turnaround columns for one order, or null when 0017 isn't applied (or the order is gone). */
export async function readTurnaroundColumns(
  service: Service,
  orderId: string,
): Promise<{ turnaround: unknown; production_clock_at: string | null } | null> {
  try {
    const { data, error } = await service
      .from("orders")
      .select("turnaround, production_clock_at")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !data) return null;
    return { turnaround: data.turnaround, production_clock_at: data.production_clock_at };
  } catch {
    return null;
  }
}

/** Store an order's turnaround. False when the column is missing; never throws. */
export async function writeTurnaround(service: Service, orderId: string, t: Turnaround): Promise<boolean> {
  try {
    const { error } = await service.from("orders").update({ turnaround: asJson(t) }).eq("id", orderId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * The turnaround a newly placed order starts on: a rush tier runs on its own
 * day count, a date the customer picked is a request for the shop to confirm,
 * everything else gets the shop's standard window (snapshotted, so a later
 * settings edit can't move an order that is already counting).
 */
export function placementTurnaround(
  standard: StandardWindow,
  opts: { rushDays?: number | null; neededBy?: string | null } = {},
): Turnaround {
  if (opts.rushDays && opts.rushDays > 0) return { kind: "days", min: opts.rushDays, max: opts.rushDays };
  if (opts.neededBy) return { kind: "date", requested: true };
  return { kind: "days", min: standard.min, max: standard.max };
}

/**
 * Bring the order's count in line with its status and payment. Starts it the
 * first time the order is approved and paid (or goes into production): stamps
 * production_clock_at, locks the window, and sets due_date to the far end of
 * the window so the admin list sorts on the real date. Clears it again if the
 * order steps back before approval (a new proof round), so the count restarts
 * at the next approval. Call after anything that moves status or payment.
 * Never throws.
 */
export async function syncProductionClock(service: Service, orderId: string): Promise<void> {
  try {
    const { data: o, error } = await service
      .from("orders")
      .select("status, paid_at, due_date, turnaround, production_clock_at")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !o) return; // 0017 not applied (or no such order): no clock to keep.

    const running = !!o.production_clock_at;

    if (!running && clockShouldRun(o.status, o.paid_at)) {
      const t = resolveTurnaround(o.turnaround, o.due_date, await loadStandardWindow(service));
      const now = new Date();
      const startedOn = shopDateOf(now);
      const patch: OrderUpdate = { production_clock_at: now.toISOString() };
      let message: string;
      if (t.kind === "days") {
        const w = readyWindow(startedOn, t);
        patch.turnaround = asJson(t);
        patch.due_date = w.to;
        message =
          t.min === t.max
            ? `Approved and paid. Ready by ${fmtReadyDay(w.to)} (${fmtDaysRange(t)})`
            : `Approved and paid. Ready ${fmtReadyDay(w.from)} to ${fmtReadyDay(w.to)} (${fmtDaysRange(t)})`;
      } else {
        message = `Approved and paid. In hands by ${fmtReadyDay(o.due_date!)}`;
      }
      // Guarded so two paths finishing at once (webhook + reconcile) start it once.
      const { data: started } = await service
        .from("orders")
        .update(patch)
        .eq("id", orderId)
        .is("production_clock_at", null)
        .select("id")
        .maybeSingle();
      if (started) {
        await service.from("order_activity").insert({
          order_id: orderId,
          actor_name: "System",
          type: "turnaround",
          detail: asJson({ message, startedOn, dueDate: patch.due_date ?? o.due_date }),
        });
      }
      return;
    }

    if (running && PRE_APPROVAL_STATUSES.has(o.status)) {
      const t = resolveTurnaround(o.turnaround, o.due_date, await loadStandardWindow(service));
      const patch: OrderUpdate = { production_clock_at: null };
      // A business-day date came from the clock, so it goes with it. A fixed date stays.
      if (t.kind === "days") patch.due_date = null;
      await service.from("orders").update(patch).eq("id", orderId);
      await service.from("order_activity").insert({
        order_id: orderId,
        actor_name: "System",
        type: "turnaround",
        detail: asJson({ message: "Back before approval. The ready date restarts at the next approval and payment" }),
      });
    }
  } catch (e) {
    console.error("[turnaround] clock sync failed", e);
  }
}

/**
 * The customer-facing ready estimate for an order page. Reads the turnaround
 * columns with the service client (the portal's RLS read doesn't select them)
 * and the shop's standard window. Never throws: null hides the estimate.
 */
export async function resolveReadyBy(
  service: Service,
  order: { id: string; status: string; paid_at: string | null; due_date: string | null },
): Promise<ReadyBy | null> {
  try {
    const [cols, standard] = await Promise.all([readTurnaroundColumns(service, order.id), loadStandardWindow(service)]);
    return readyByFor({ ...order, ...(cols ?? {}) }, standard);
  } catch {
    return null;
  }
}
