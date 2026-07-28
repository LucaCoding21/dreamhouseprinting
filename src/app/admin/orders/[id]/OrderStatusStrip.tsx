"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import {
  STATUS_META,
  TRACKER_STAGES,
  isBackwardStatus,
  stageTargetStatus,
  statusStageIndex,
} from "@/lib/orderStatus";
import { setOrderStatusAction } from "../actions";
import { StatusChangeConfirm } from "./StatusChangeConfirm";
import { useOrderAction, type Detail } from "./shared";
import type { OrderStatus, PaymentStatus } from "@/lib/db/rows";

/**
 * Order total, payment, and the stage stepper. The stepper is the click-to-move
 * pipeline: any stage can be picked, forwards or backwards (a reprint means
 * going back to production or the proof), with backward moves confirmed first.
 */
export function OrderStatusStrip({ detail, canEdit }: { detail: Detail; canEdit: boolean }) {
  const { order } = detail;
  const { pending, run } = useOrderAction();
  const status = order.status as OrderStatus;
  const stageIdx = statusStageIndex(status);
  const [confirmTo, setConfirmTo] = useState<OrderStatus | null>(null);

  const pricing = (order.pricing ?? {}) as { total?: number };
  const total = pricing.total ?? 0;
  const payment = order.payment_status as PaymentStatus;
  const paymentBadge: "success" | "info" | "warn" | "neutral" =
    payment === "paid_in_full" ? "success" : payment.startsWith("deposit") ? "info" : payment === "refunded" ? "neutral" : "warn";

  function move(target: OrderStatus) {
    if (target === status) return;
    if (isBackwardStatus(status, target)) {
      setConfirmTo(target);
      return;
    }
    run(() => setOrderStatusAction(order.id, target), "Status updated");
  }

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
          const target = stageTargetStatus(stage.key, order.fulfillment_method);
          const clickable = canEdit && target !== status;
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
              <button
                type="button"
                disabled={!clickable || pending}
                onClick={() => move(target)}
                title={
                  clickable
                    ? `Move this order to ${STATUS_META[target].label}`
                    : current
                      ? "Current stage"
                      : undefined
                }
                className={cn(
                  "group relative z-10 flex flex-col items-center",
                  clickable ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-shadow",
                    done && "border-dream-success bg-dream-success text-white",
                    current && "border-dream-purple bg-dream-purple text-white ring-4 ring-dream-lavender-soft",
                    !done && !current && "border-transparent bg-dream-bg text-dream-faint",
                    clickable && "group-hover:ring-4 group-hover:ring-dream-purple/20",
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
                <span
                  className={cn(
                    "mt-2 px-1 text-[11px] font-medium",
                    current ? "text-dream-ink" : "text-dream-muted",
                    clickable && "group-hover:text-dream-purple",
                  )}
                >
                  {stage.label}
                </span>
              </button>
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

      {canEdit && (
        <p className="mt-4 text-center text-[11px] text-dream-faint">
          Click any stage to move the order there. Going back (a reprint, a redo) asks first.
        </p>
      )}

      <StatusChangeConfirm
        open={confirmTo !== null}
        onOpenChange={(o) => !o && setConfirmTo(null)}
        from={status}
        to={confirmTo}
        pending={pending}
        onConfirm={() => {
          const target = confirmTo;
          if (!target) return;
          run(() => setOrderStatusAction(order.id, target), "Status updated", () => setConfirmTo(null));
        }}
      />
    </div>
  );
}
