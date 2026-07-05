"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { STATUS_META, TRACKER_STAGES, statusStageIndex } from "@/lib/orderStatus";
import { ORDER_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/db/rows";
import { setOrderStatusAction, addOrderNoteAction, sendInvoiceAction, setTrackingAction } from "../actions";
import { ProofReviewDialog } from "./ProofReviewDialog";
import { fmtDay, nextAction, useOrderAction, type Can, type Detail } from "./shared";

const PRE_APPROVAL = new Set<string>(["draft", "submitted", "in_review", "proof_ready", "changes_requested"]);

export function CommandHeader({ detail, can, who }: { detail: Detail; can: Can; who: string }) {
  const { order } = detail;
  const { toast } = useToast();
  const { pending, run } = useOrderAction();
  const [proofOpen, setProofOpen] = useState(false);

  const status = order.status as OrderStatus;
  const kind = nextAction(order);
  const stageIdx = statusStageIndex(status);

  const pricing = (order.pricing ?? {}) as { total?: number };
  const total = pricing.total ?? 0;
  const payment = order.payment_status as PaymentStatus;
  const paymentBadge: "success" | "info" | "warn" | "neutral" =
    payment === "paid_in_full" ? "success" : payment.startsWith("deposit") ? "info" : payment === "refunded" ? "neutral" : "warn";

  const [jumpOpen, setJumpOpen] = useState(false);
  const [invoiceConfirm, setInvoiceConfirm] = useState(false);
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [tracking, setTracking] = useState(order.shipping_tracking ?? "");

  // Latest change request (for the changes_requested callout).
  const latestChange = detail.proofs
    .filter((p) => p.status === "changes_requested" && p.change_request_comment)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  function goToStatus(target: OrderStatus) {
    if (target === status) return;
    const targetIdx = ORDER_STATUSES.indexOf(target);
    const currentIdx = ORDER_STATUSES.indexOf(status);
    if (targetIdx >= 0 && currentIdx >= 0 && targetIdx < currentIdx && !["on_hold", "cancelled"].includes(target)) {
      if (!window.confirm(`Move backwards to “${STATUS_META[target].label}”?`)) return;
    }
    run(() => setOrderStatusAction(order.id, target), "Status updated", () => setJumpOpen(false));
  }

  function putOnHold() {
    const reason = window.prompt("Reason for hold (optional) — added as an internal comment:") ?? "";
    run(async () => {
      const r = await setOrderStatusAction(order.id, "on_hold");
      if (!r.error && reason.trim()) await addOrderNoteAction(order.id, `On hold: ${reason.trim()}`, "internal");
      return r;
    }, "Order placed on hold");
  }

  function sendInvoice() {
    if (PRE_APPROVAL.has(status)) {
      setInvoiceConfirm(true);
      return;
    }
    run(() => sendInvoiceAction(order.id), order.invoice_sent_at ? "Invoice re-sent" : "Invoice sent");
  }

  function markShipped() {
    const willTrack = tracking.trim() !== "";
    run(
      () => (willTrack ? setTrackingAction(order.id, tracking) : setOrderStatusAction(order.id, "shipped")),
      "Order marked shipped",
      () => setShipOpen(false),
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/o/${order.public_token}`);
      toast({ title: "Order link copied", variant: "success" });
    } catch {
      toast({ title: "Could not copy link", variant: "error" });
    }
  }

  const pickProof = () => setProofOpen(true);

  return (
    <div className="space-y-5 rounded-xl border border-dream-line bg-dream-surface p-5 shadow-sm sm:p-6">
      {/* Row 1 — nav + utilities */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/orders" className="text-sm text-dream-purple hover:underline">
          ← Back to orders
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copyLink}>
            Copy order link
          </Button>
          {can.edit && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg border border-dream-line bg-white text-dream-ink transition-colors hover:bg-dream-bg" aria-label="More actions">
                <span className="text-lg leading-none">⋯</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={status === "on_hold"} onClick={putOnHold}>
                  Put on hold
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setJumpOpen(true)}>Jump to status…</DropdownMenuItem>
                <DropdownMenuItem
                  disabled={status === "cancelled"}
                  className="text-dream-danger hover:bg-dream-danger-soft"
                  onClick={() => {
                    if (window.confirm("Cancel this order?")) goToStatus("cancelled");
                  }}
                >
                  Cancel order
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Row 2 — identity + money */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-dream-ink">Order {order.order_number ?? ""}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-dream-muted">
            <span className="font-medium text-dream-ink">{who}</span>
            <span aria-hidden>·</span>
            <span>Created {fmtDay(order.created_at)}</span>
            {order.due_date && (
              <>
                <span aria-hidden>·</span>
                <span>Due {fmtDay(order.due_date)}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-bold text-dream-ink">{formatCAD(total)}</div>
          <div className="mt-1">
            <Badge variant={paymentBadge}>{payment === "paid_in_full" ? "Paid" : payment.replace(/_/g, " ")}</Badge>
          </div>
        </div>
      </div>

      {order.hold_note && (
        <div className="rounded-lg border border-dream-warn/40 bg-dream-warn-soft px-4 py-3 text-sm text-dream-warn">
          <strong>On hold:</strong> {order.hold_note}
        </div>
      )}

      {/* Row 3 — stepper */}
      <div className="flex items-start">
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

      {/* Row 3 — hero action */}
      {can.edit && (
        <div className="border-t border-dream-line pt-5">{renderHero()}</div>
      )}

      <ProofReviewDialog
        orderId={order.id}
        open={proofOpen}
        onOpenChange={setProofOpen}
        orderNumber={order.order_number}
        customerName={who}
        isReplacement={status === "changes_requested" || status === "proof_ready"}
      />

      {/* Jump-to-status dialog */}
      <Dialog open={jumpOpen} onOpenChange={setJumpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Jump to status</DialogTitle>
            <DialogDescription>Manually set the order status. Moving backwards asks for confirmation.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-5 pt-0">
            <ul className="space-y-1">
              {ORDER_STATUSES.map((s) => {
                const currentOne = s === status;
                return (
                  <li key={s}>
                    <button
                      type="button"
                      disabled={currentOne}
                      onClick={() => goToStatus(s)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        currentOne ? "bg-dream-lavender-soft font-semibold text-dream-purple" : "text-dream-ink hover:bg-dream-bg",
                      )}
                    >
                      {STATUS_META[s].label}
                      {currentOne && <span className="text-xs">Current</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice-before-approval confirm */}
      <Dialog open={invoiceConfirm} onOpenChange={setInvoiceConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send invoice anyway?</DialogTitle>
            <DialogDescription>
              This proof isn’t approved yet ({STATUS_META[status].label}). You can still send the invoice, but the customer usually
              approves the proof first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInvoiceConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={() => {
                setInvoiceConfirm(false);
                run(() => sendInvoiceAction(order.id), order.invoice_sent_at ? "Invoice re-sent" : "Invoice sent");
              }}
            >
              Send anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve on customer's behalf confirm */}
      <Dialog open={approveConfirm} onOpenChange={setApproveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip the approval step?</DialogTitle>
            <DialogDescription>
              The order moves straight to Approved and the customer won’t get an approval email. Do this when the design is
              print-ready as-is, or when they already approved by text or phone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={() => {
                setApproveConfirm(false);
                run(() => setOrderStatusAction(order.id, "approved"), "Proof approved");
              }}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark shipped dialog (ship orders) */}
      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as shipped</DialogTitle>
            <DialogDescription>Add a tracking number so the customer can follow their package, or skip it.</DialogDescription>
          </DialogHeader>
          <div className="p-5 pt-0">
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number e.g. 1Z…" />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              loading={pending}
              onClick={() => run(() => setOrderStatusAction(order.id, "shipped"), "Order marked shipped", () => setShipOpen(false))}
            >
              Skip tracking
            </Button>
            <Button variant="primary" loading={pending} onClick={markShipped}>
              Mark shipped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderHero() {
    switch (kind) {
      case "mark-received":
        return (
          <HeroButton
            label="Mark received"
            loading={pending}
            onClick={() => run(() => setOrderStatusAction(order.id, "submitted"), "Order received")}
          />
        );
      case "upload-proof":
        return (
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" disabled={!can.proofs} onClick={pickProof} className="min-w-48">
              Upload proof
            </Button>
            <p className="text-sm text-dream-muted">Sends the customer an approval email</p>
            <Button variant="ghost" className="ml-auto" onClick={() => setApproveConfirm(true)}>
              Looks good — skip proof
            </Button>
          </div>
        );
      case "awaiting-approval":
        return (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="warn" className="px-3 py-1.5 text-sm">
              Waiting on customer approval
            </Badge>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!can.proofs} onClick={pickProof}>
                Upload new proof
              </Button>
              <Button variant="secondary" onClick={() => setApproveConfirm(true)}>
                Approve on customer’s behalf
              </Button>
            </div>
          </div>
        );
      case "upload-new-proof":
        return (
          <div className="space-y-3">
            {latestChange && (
              <div className="rounded-lg border border-dream-warn/40 bg-dream-warn-soft px-4 py-3 text-sm text-dream-warn">
                Customer asked: “{latestChange.change_request_comment}”
              </div>
            )}
            <HeroButton label="Upload new proof" disabled={!can.proofs} onClick={pickProof} />
          </div>
        );
      case "approved-invoice":
        return (
          <div className="flex flex-wrap items-center gap-3">
            {can.pricing ? (
              <HeroButton label="Send invoice" loading={pending} onClick={sendInvoice} inline disabled={total <= 0} />
            ) : null}
            <Button variant="secondary" loading={pending} onClick={() => run(() => setOrderStatusAction(order.id, "in_production"), "Moved to production")}>
              Start production
            </Button>
          </div>
        );
      case "start-production":
        return (
          <HeroButton
            label="Start production"
            loading={pending}
            onClick={() => run(() => setOrderStatusAction(order.id, "in_production"), "Moved to production")}
          />
        );
      case "mark-shipped":
        return <HeroButton label="Mark shipped" loading={pending} onClick={() => setShipOpen(true)} />;
      case "ready-for-pickup":
        return (
          <HeroButton
            label="Ready for pickup"
            loading={pending}
            onClick={() => run(() => setOrderStatusAction(order.id, "ready_for_pickup"), "Marked ready for pickup")}
          />
        );
      case "complete":
        return (
          <HeroButton
            label="Complete order"
            loading={pending}
            onClick={() => run(() => setOrderStatusAction(order.id, "completed"), "Order completed")}
          />
        );
      case "completed":
        return <Badge variant="success" className="px-3 py-1.5 text-sm">Order complete</Badge>;
      case "on-hold":
        return (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="warn" className="px-3 py-1.5 text-sm">On hold</Badge>
            <Button variant="primary" className="ml-auto" onClick={() => setJumpOpen(true)}>
              Resume order
            </Button>
          </div>
        );
      case "cancelled":
        return <Badge variant="danger" className="px-3 py-1.5 text-sm">Cancelled</Badge>;
      default:
        return null;
    }
  }
}

function HeroButton({
  label,
  caption,
  loading,
  disabled,
  onClick,
  inline,
}: {
  label: string;
  caption?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  inline?: boolean;
}) {
  return (
    <div className={cn(inline ? "" : "flex flex-wrap items-center gap-4")}>
      <Button variant="primary" size="lg" loading={loading} disabled={disabled} onClick={onClick} className="min-w-48">
        {label}
      </Button>
      {caption && <p className="text-sm text-dream-muted">{caption}</p>}
    </div>
  );
}
