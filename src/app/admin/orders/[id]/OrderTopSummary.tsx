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
    <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
      <div>
        <div className={LBL}>Stage</div>
        <div className="mt-0.5 font-display text-sm font-bold text-dream-ink">{stage}</div>
      </div>
      <div>
        <div className={LBL}>Order total</div>
        <div className="font-display text-2xl font-bold leading-tight text-dream-ink">{formatCAD(total)}</div>
      </div>
      <div>
        <div className={LBL}>Payment</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={paymentBadge}>{paid ? "Paid" : payment.replace(/_/g, " ")}</Badge>
          {etransferPending && <Badge variant="warn">E-transfer to verify</Badge>}
        </div>
      </div>
    </div>
  );
}
