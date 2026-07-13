import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { STATUS_META, TRACKER_STAGES, statusStageIndex } from "@/lib/orderStatus";
import type { OrderStatus, PaymentStatus } from "@/lib/db/rows";
import type { Detail } from "./shared";

/** Bottom-of-page status + money summary: order total, payment, and the stage stepper. */
export function OrderStatusStrip({ detail }: { detail: Detail }) {
  const { order } = detail;
  const status = order.status as OrderStatus;
  const stageIdx = statusStageIndex(status);

  const pricing = (order.pricing ?? {}) as { total?: number };
  const total = pricing.total ?? 0;
  const payment = order.payment_status as PaymentStatus;
  const paymentBadge: "success" | "info" | "warn" | "neutral" =
    payment === "paid_in_full" ? "success" : payment.startsWith("deposit") ? "info" : payment === "refunded" ? "neutral" : "warn";

  return (
    <div className="rounded-xl border border-dream-line bg-dream-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-dream-muted">Order total</div>
          <div className="font-display text-2xl font-bold text-dream-ink">{formatCAD(total)}</div>
        </div>
        <Badge variant={paymentBadge}>{payment === "paid_in_full" ? "Paid" : payment.replace(/_/g, " ")}</Badge>
      </div>

      <div className="mt-5 flex items-start border-t border-dream-line pt-5">
        {TRACKER_STAGES.map((stage, i) => {
          const done = stageIdx >= 0 && i < stageIdx;
          const current = stageIdx === i;
          return (
            <div key={stage.key} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && (
                <span
                  className={cn(
                    "absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2",
                    stageIdx >= 0 && i <= stageIdx ? "bg-dream-success" : "bg-dream-line-strong",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  done && "border-dream-success bg-dream-success text-white",
                  current && "border-dream-purple bg-dream-purple text-white ring-4 ring-dream-lavender-soft",
                  !done && !current && "border-transparent bg-dream-bg text-dream-faint",
                )}
              >
                {done ? (
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
                    <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={cn("mt-2 px-1 text-[11px] font-medium", current ? "text-dream-ink" : "text-dream-muted")}>
                {stage.label}
              </span>
              {current && (
                <span
                  className={cn(
                    "mt-0.5 px-1 text-[11px] font-semibold",
                    status === "changes_requested" ? "text-dream-warn" : "text-dream-purple",
                  )}
                >
                  {STATUS_META[status].label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
