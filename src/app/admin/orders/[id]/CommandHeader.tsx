"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { STATUS_META } from "@/lib/orderStatus";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/rows";
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

  const pricing = (order.pricing ?? {}) as { total?: number };
  const total = pricing.total ?? 0;

  const [jumpOpen, setJumpOpen] = useState(false);
  const [invoiceConfirm, setInvoiceConfirm] = useState(false);
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [approveReason, setApproveReason] = useState("");
  const [shipOpen, setShipOpen] = useState(false);
  const [tracking, setTracking] = useState(order.shipping_tracking ?? "");

  // Approve on the customer's behalf, recording WHY as an internal note (paper
  // trail — with many orders, an on-behalf approval needs a reason on record).
  function approveOnBehalf() {
    const reason = approveReason.trim();
    if (!reason) return;
    run(
      async () => {
        const r = await setOrderStatusAction(order.id, "approved");
        if (!r.error) await addOrderNoteAction(order.id, `Approved on customer's behalf: ${reason}`, "internal");
        return r;
      },
      "Proof approved",
      () => {
        setApproveConfirm(false);
        setApproveReason("");
      },
    );
  }

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
    run(() => sendInvoiceAction(order.id), order.invoice_sent_at ? "Payment link re-sent" : "Payment link emailed");
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

      {/* Row 2 — identity + status */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-dream-ink">Order {order.order_number ?? ""}</h1>
            <Badge variant={status === "changes_requested" ? "warn" : "info"}>{STATUS_META[status].label}</Badge>
          </div>
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
      </div>

      {order.hold_note && (
        <div className="rounded-lg border border-dream-warn/40 bg-dream-warn-soft px-4 py-3 text-sm text-dream-warn">
          <strong>On hold:</strong> {order.hold_note}
        </div>
      )}

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
        orderTotal={total}
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
                run(() => sendInvoiceAction(order.id), order.invoice_sent_at ? "Payment link re-sent" : "Payment link emailed");
              }}
            >
              Send anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve on customer's behalf confirm */}
      <Dialog
        open={approveConfirm}
        onOpenChange={(o) => {
          setApproveConfirm(o);
          if (!o) setApproveReason("");
        }}
      >
        <DialogContent backdropClassName="bg-dream-overlay/50 backdrop-blur-sm">
          <DialogClose />
          <DialogHeader>
            <DialogTitle>Approve on the customer’s behalf?</DialogTitle>
            <DialogDescription>
              The order moves straight to Approved and the customer won’t get an approval email. Do this when the design is
              print-ready as-is, or when they already approved by text or phone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 pt-0">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-dream-muted">
              Why are you approving for them? (internal — the customer never sees this)
            </label>
            <Textarea
              rows={3}
              autoFocus
              value={approveReason}
              onChange={(e) => setApproveReason(e.target.value)}
              placeholder="e.g. customer approved by text, print-ready as submitted"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} disabled={!approveReason.trim()} onClick={approveOnBehalf}>
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
            <p className="text-sm text-dream-muted">
              Sends an approval email — the customer approves &amp; pays in one step, so double-check pricing first
            </p>
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
            <p className="text-sm text-dream-muted">They&rsquo;ll be asked to pay the current total the moment they approve</p>
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
            <Badge variant="warn" className="px-3 py-1.5 text-sm">
              Approved — awaiting payment
            </Badge>
            <p className="text-sm text-dream-muted">The customer can pay from their order page any time</p>
            <div className="ml-auto flex flex-wrap gap-2">
              {can.pricing && (
                <Button variant="secondary" loading={pending} disabled={total <= 0} onClick={sendInvoice}>
                  {order.invoice_sent_at ? "Re-send payment link" : "Email payment link"}
                </Button>
              )}
              <Button variant="secondary" loading={pending} onClick={() => run(() => setOrderStatusAction(order.id, "in_production"), "Moved to production")}>
                Start production
              </Button>
            </div>
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
