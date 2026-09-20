import { Badge } from "@/components/ui/Badge";
import { formatCAD } from "@/lib/money";
import { STATUS_META, TRACKER_STAGES, statusStageIndex } from "@/lib/orderStatus";
import type { OrderRow, OrderStatus, PaymentStatus } from "@/lib/db/rows";
import { LBL } from "./shared";

/**
 * The three numbers Julian wants before he scrolls anything: where the job is,
 * what it is worth, and whether it has been paid. Sits in the command header
 * beside the order number.
 */
export function OrderTopSummary({ order }: { order: OrderRow }) {
  const status = order.status as OrderStatus;
  const stageIdx = statusStageIndex(status);
  const stage =
    stageIdx >= 0 ? `${stageIdx + 1}/${TRACKER_STAGES.length} ${TRACKER_STAGES[stageIdx].label}` : STATUS_META[status].label;

  const total = ((order.pricing ?? {}) as { total?: number }).total ?? 0;
  const payment = order.payment_status as PaymentStatus;
  const paid = payment === "paid_in_full";
  const paymentBadge: "success" | "info" | "warn" | "neutral" = paid
    ? "success"
    : payment.startsWith("deposit")
      ? "info"
      : payment === "refunded"
        ? "neutral"
        : "warn";
  const etransferPending = !!order.etransfer_reported_at && !order.paid_at;

  return (
    // Phone: one tinted panel so the three facts read as a group, with the
    // total as the primary figure, payment beside it, and the stage as a
    // progress line underneath. sm+: the original inline strip (Stage, Total,
    // Payment) beside the order title, restored via order-* and the resets.
    <div className="w-full rounded-xl bg-dream-bg p-4 sm:w-auto sm:rounded-none sm:bg-transparent sm:p-0">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:items-start sm:gap-x-8 sm:gap-y-3">
        <div className="sm:order-2">
          <div className={LBL}>Order total</div>
          <div className="mt-0.5 font-display text-2xl font-bold leading-tight text-dream-ink sm:mt-0">{formatCAD(total)}</div>
        </div>
        <div className="sm:order-3">
          <div className={LBL}>Payment</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-1">
            <Badge variant={paymentBadge}>{paid ? "Paid" : payment.replace(/_/g, " ")}</Badge>
            {etransferPending && <Badge variant="warn">E-transfer to verify</Badge>}
          </div>
        </div>
        <div className="col-span-2 border-t border-dream-line pt-3 sm:order-1 sm:col-span-1 sm:border-0 sm:pt-0">
          <div className={LBL}>Stage</div>
          <div className="mt-0.5 font-display text-sm font-bold text-dream-ink">{stage}</div>
          {/* Phone-only progress segments: five ticks, one per tracker stage,
              so the position reads at a glance without parsing "1/5". */}
          {stageIdx >= 0 && (
            <div className="mt-2 flex gap-1 sm:hidden" aria-hidden="true">
              {TRACKER_STAGES.map((t, i) => (
                <span
                  key={t.label}
                  className={i <= stageIdx ? "h-1.5 flex-1 rounded-full bg-dream-purple" : "h-1.5 flex-1 rounded-full bg-dream-line-strong"}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
