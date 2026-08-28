"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { STATUS_META, isBackwardStatus } from "@/lib/orderStatus";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/rows";
import {
  setOrderStatusAction,
  sendForApprovalAction,
  addOrderNoteAction,
  sendInvoiceAction,
  setTrackingAction,
} from "../actions";
import { EtransferVerify } from "./EtransferVerify";
import { ProofReviewDialog } from "./ProofReviewDialog";
import { OrderTopSummary } from "./OrderTopSummary";
import { StatusChangeConfirm } from "./StatusChangeConfirm";
import { fmtDay, relativeTime, nextAction, useOrderAction, type Can, type Detail } from "./shared";

const PRE_APPROVAL = new Set<string>(["draft", "submitted", "in_review", "proof_ready", "changes_requested"]);

/**
 * Activity that means the ORDER changed, so a proof already with the customer is
 * now out of date. "order_edited" is the generic marker; the rest are the
 * specific edit logs the order actions write today.
 */
const EDIT_ACTIVITY = new Set<string>([
  "order_edited",
  "proof_uploaded",
  "items_updated",
  "item_removed",
  "product_changed",
  "price_edit",
]);

/** "Dad Hat, Tote bag and 2 more", so a long list can't swallow the caption. */
function nameList(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

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
  const [sendConfirm, setSendConfirm] = useState(false);
  /** "Send for approval" with no customer email; Julian passes the link on himself. */
  const [sendSilent, setSendSilent] = useState(false);
  const [invoiceConfirm, setInvoiceConfirm] = useState(false);
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [approveReason, setApproveReason] = useState("");
  const [shipOpen, setShipOpen] = useState(false);
  const [backTo, setBackTo] = useState<OrderStatus | null>(null);
  const [tracking, setTracking] = useState(order.shipping_tracking ?? "");

  // Approve on the customer's behalf, recording WHY as an internal note (paper
  // trail, with many orders, an on-behalf approval needs a reason on record).
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

  /**
   * Proof coverage. Proofs filed on the order are drafts until "Send for
   * approval" puts the whole set in front of the customer, and the order can
   * only go once EVERY line has one of its own (the server enforces the same
   * rule in proofGateError), so nobody approves a garment they never saw.
   * Mirrored here so the send button is simply absent rather than erroring.
   */
  const { pendingProofs, proofLines, missingProofLines, allLinesCovered } = useMemo(() => {
    const pending = detail.proofs.filter((p) => p.status === "pending");
    const lines = detail.lineItems.map((li, i) => {
      const colour = (li.colour ?? {}) as { name?: string };
      const name = li.product_name?.trim() || `Item ${i + 1}`;
      return { id: li.id, name, label: [name, colour.name].filter(Boolean).join(" · ") };
    });
    // A one-line order also accepts an order-level (unassigned) proof: uploads
    // are pinned to the only line now, but older rows predate that.
    const orderLevel = pending.some((p) => !p.line_item_id);
    const covered = new Set(pending.map((p) => p.line_item_id).filter(Boolean) as string[]);
    const missing =
      lines.length === 1 && orderLevel ? [] : lines.filter((l) => !covered.has(l.id)).map((l) => l.name);
    return {
      pendingProofs: pending.length,
      proofLines: lines,
      missingProofLines: missing,
      // An order with no lines falls back to "is there any proof at all".
      allLinesCovered: lines.length === 0 ? pending.length > 0 : missing.length === 0,
    };
  }, [detail.lineItems, detail.proofs]);

  /** "Proofs on 1 of 3 items. Still missing: Dad Hat, Tote bag" */
  const coverageCaption = `Proofs on ${detail.lineItems.length - missingProofLines.length} of ${
    detail.lineItems.length
  } ${detail.lineItems.length === 1 ? "item" : "items"}. Still missing: ${nameList(missingProofLines)}`;

  /** Ready to send: a proof is waiting AND every line has one. */
  const canSend = pendingProofs > 0 && allLinesCovered;

  // Latest change request (for the changes_requested callout).
  const latestChange = detail.proofs
    .filter((p) => p.status === "changes_requested" && p.change_request_comment)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // When did the customer last get this order for approval, and has it been
  // edited since? Sends are either the move to proof_ready or an explicit
  // (re)send logged as approval_sent.
  const { lastSentAt, lastEditAt } = useMemo(() => {
    let sent: string | null = null;
    let edit: string | null = null;
    for (const a of detail.activity) {
      const to = (a.detail as { to?: string } | null)?.to;
      const isSend = a.type === "approval_sent" || (a.type === "status_change" && to === "proof_ready");
      if (isSend && (!sent || a.created_at > sent)) sent = a.created_at;
      if (EDIT_ACTIVITY.has(a.type) && (!edit || a.created_at > edit)) edit = a.created_at;
    }
    return { lastSentAt: sent, lastEditAt: edit };
  }, [detail.activity]);

  // The customer is looking at a stale version: flag it hard at the top of the
  // page. Only while the order is still open for approval, and only with a proof
  // on file to send. changes_requested doesn't need the banner, its hero action
  // already IS "Send for approval".
  const changedSinceSend =
    status === "proof_ready" && pendingProofs > 0 && !!lastSentAt && !!lastEditAt && lastEditAt > lastSentAt;
  const alreadySent = status === "proof_ready";

  function openSend(silent: boolean) {
    setSendSilent(silent);
    setSendConfirm(true);
  }

  function sendForApproval() {
    const silent = sendSilent;
    run(
      () => sendForApprovalAction(order.id, { silent }),
      silent ? "Order updated, no email sent" : alreadySent ? "Sent to the customer again" : "Sent to customer for approval",
      () => {
        setSendConfirm(false);
        setSendSilent(false);
      },
    );
  }

  function applyStatusMove(target: OrderStatus, confirmed = false) {
    run(() => setOrderStatusAction(order.id, target, confirmed), "Status updated", () => {
      setJumpOpen(false);
      setBackTo(null);
    });
  }

  function goToStatus(target: OrderStatus, confirmed = false) {
    if (target === status) return;
    // Backwards means a reprint or a redo, so it gets a real confirmation
    // (emails go out exactly as they do for a forward move).
    if (isBackwardStatus(status, target)) {
      setBackTo(target);
      return;
    }
    applyStatusMove(target, confirmed);
  }

  function putOnHold() {
    const reason = window.prompt("Reason for hold (optional), added as an internal comment:") ?? "";
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
      {/* Row 1, nav + utilities */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/orders" className="text-sm text-dream-purple hover:underline">
          Back to orders
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
                    // The prompt IS the human confirmation the server requires to
                    // cancel a paid order, so pass confirmed through.
                    if (window.confirm("Cancel this order?")) goToStatus("cancelled", true);
                  }}
                >
                  Cancel order
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Row 2, identity + status + the money/stage summary, all above the fold */}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-dream-ink sm:text-3xl">Order {order.order_number ?? ""}</h1>
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

        <OrderTopSummary order={order} />
      </div>

      {order.hold_note && (
        <div className="rounded-lg border border-dream-warn/40 bg-dream-warn-soft px-4 py-3 text-sm text-dream-warn">
          <strong>On hold:</strong> {order.hold_note}
        </div>
      )}

      {/* Row 3, hero action (with the stale-proof callout above it when it applies) */}
      {can.edit && (
        <div className="border-t border-dream-line pt-5">
          {changedSinceSend && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-dream-warn/40 bg-dream-warn-soft px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-dream-warn">Order changed since it was sent for approval</p>
                <p className="mt-0.5 text-sm text-dream-warn">
                  {who} is looking at the old version. Last edit {relativeTime(lastEditAt!)}, last sent{" "}
                  {relativeTime(lastSentAt!)}.
                </p>
                {!allLinesCovered && <p className="mt-0.5 text-sm text-dream-warn">{coverageCaption}</p>}
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                {/* Same rule as everywhere else: it can only go out once every
                    line has a proof waiting. */}
                {allLinesCovered ? (
                  <>
                    <Button variant="primary" className="w-full sm:w-auto" onClick={() => openSend(false)}>
                      Send for approval
                    </Button>
                    <Button variant="ghost" className="w-full sm:w-auto" onClick={() => openSend(true)}>
                      Send without email
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    className="w-full sm:w-auto"
                    disabled={!can.proofs}
                    onClick={pickProof}
                  >
                    Upload proof
                  </Button>
                )}
              </div>
            </div>
          )}
          {renderHero()}
        </div>
      )}

      <ProofReviewDialog
        orderId={order.id}
        // Order-level upload: on a multi-item order the dialog asks which item
        // the proof is for, so every line ends up covered.
        lines={proofLines}
        open={proofOpen}
        onOpenChange={setProofOpen}
        orderNumber={order.order_number}
        customerName={who}
        isReplacement={status === "changes_requested" || status === "proof_ready"}
      />

      {/* Send-for-approval confirm: the one moment the customer gets emailed,
          unless the silent box is ticked. Shared by the first send and every re-send. */}
      <Dialog
        open={sendConfirm}
        onOpenChange={(o) => {
          setSendConfirm(o);
          if (!o) setSendSilent(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{alreadySent ? "Send this order for approval again?" : "Send this order for approval?"}</DialogTitle>
            <DialogDescription>
              {sendSilent ? (
                <>
                  Nothing is emailed. The order stays open for approval with{" "}
                  {pendingProofs === 1 ? "the proof" : `all ${pendingProofs} proofs`} on it, so you can send {who} the order
                  link yourself.
                </>
              ) : (
                <>
                  {who} gets one email with {pendingProofs === 1 ? "the proof" : `all ${pendingProofs} proofs`} and is asked
                  to approve and pay {total > 0 ? formatCAD(total) : ""} in one step. Make sure every line is checked and
                  finalized first.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="px-5">
            <Checkbox
              id="send-silent"
              checked={sendSilent}
              onChange={(e) => setSendSilent(e.target.checked)}
              label="Don't email the customer, I'll send them the link"
            />
          </div>
          {!sendSilent && total <= 0 && (
            <p className="mx-5 mt-3 rounded-lg border border-dream-warn/30 bg-dream-warn-soft px-3 py-2 text-xs text-dream-warn">
              This order has no total yet. The customer can approve but not pay, so set the pricing before sending.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={sendForApproval}>
              {sendSilent ? "Send without email" : alreadySent ? "Send again" : "Send for approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backward move confirm, shared with the stage stepper */}
      <StatusChangeConfirm
        open={backTo !== null}
        onOpenChange={(o) => !o && setBackTo(null)}
        from={status}
        to={backTo}
        pending={pending}
        onConfirm={() => backTo && applyStatusMove(backTo)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve on the customer’s behalf?</DialogTitle>
            <DialogDescription>
              The order moves straight to Approved and the customer won’t get an approval email. Do this when the design is
              print-ready as-is, or when they already approved by text or phone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 pt-0">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-dream-muted">
              Why are you approving for them? (internal, the customer never sees this)
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
            {canSend ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  loading={pending}
                  onClick={() => openSend(false)}
                  className="w-full sm:w-auto sm:min-w-48"
                >
                  Send for approval
                </Button>
                <p className="text-sm text-dream-muted">
                  {pendingProofs === 1 ? "1 proof is" : `${pendingProofs} proofs are`} on the order, nothing emailed yet
                </p>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={!can.proofs}
                  onClick={pickProof}
                  className="w-full sm:w-auto sm:min-w-48"
                >
                  Upload proof
                </Button>
                <p className="text-sm text-dream-muted">
                  {/* Part-proofed: name what's still missing, since that is the
                      only thing standing between here and sending. */}
                  {pendingProofs > 0
                    ? coverageCaption
                    : "Uploads just save to the order. The whole order goes to the customer when you send it for approval."}
                </p>
              </>
            )}
            <Button
              variant="ghost"
              className="w-full sm:ml-auto sm:w-auto"
              onClick={() => setApproveConfirm(true)}
            >
              Looks good, skip proof
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
            <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
              {/* The banner above already offers this when the order changed. */}
              {!changedSinceSend && canSend && (
                <Button variant="secondary" className="w-full sm:w-auto" onClick={() => openSend(false)}>
                  Send for approval again
                </Button>
              )}
              <Button variant="secondary" className="w-full sm:w-auto" disabled={!can.proofs} onClick={pickProof}>
                Upload new proof
              </Button>
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setApproveConfirm(true)}>
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
            {canSend ? (
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  loading={pending}
                  onClick={() => openSend(false)}
                  className="w-full sm:w-auto sm:min-w-48"
                >
                  Send for approval
                </Button>
                <p className="text-sm text-dream-muted">
                  {pendingProofs === 1 ? "1 new proof is" : `${pendingProofs} new proofs are`} on the order, nothing emailed yet
                </p>
              </div>
            ) : (
              <HeroButton
                label="Upload new proof"
                // A change request needs a NEW proof on every line, the old
                // (now decided) ones don't count towards coverage.
                caption={
                  pendingProofs > 0
                    ? coverageCaption
                    : "Uploads just save to the order, send it for approval when it's ready"
                }
                disabled={!can.proofs}
                onClick={pickProof}
              />
            )}
          </div>
        );
      case "verify-etransfer":
        return (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="warn" className="px-3 py-1.5 text-sm">
              E-transfer to verify
            </Badge>
            <p className="text-sm text-dream-muted">
              The customer says they sent {formatCAD(total)} by Interac e-Transfer. Check your bank, then confirm.
            </p>
            <div className="w-full sm:ml-auto sm:w-auto">
              <EtransferVerify
                orderId={order.id}
                amount={total}
                reportedAt={order.etransfer_reported_at ?? order.created_at}
                orderStatus={status}
                compact
              />
            </div>
          </div>
        );
      case "approved-invoice":
        return (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="warn" className="px-3 py-1.5 text-sm">
              Approved, awaiting payment
            </Badge>
            <p className="text-sm text-dream-muted">The customer can pay from their order page any time</p>
            <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
              {can.pricing && (
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  loading={pending}
                  disabled={total <= 0}
                  onClick={sendInvoice}
                >
                  {order.invoice_sent_at ? "Re-send payment link" : "Email payment link"}
                </Button>
              )}
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                loading={pending}
                onClick={() => run(() => setOrderStatusAction(order.id, "in_production"), "Moved to production")}
              >
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
            <Button variant="primary" className="w-full sm:ml-auto sm:w-auto" onClick={() => setJumpOpen(true)}>
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
      <Button
        variant="primary"
        size="lg"
        loading={loading}
        disabled={disabled}
        onClick={onClick}
        className="w-full sm:w-auto sm:min-w-48"
      >
        {label}
      </Button>
      {caption && <p className="text-sm text-dream-muted">{caption}</p>}
    </div>
  );
}
