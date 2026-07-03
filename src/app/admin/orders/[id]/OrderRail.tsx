"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { STATUS_META } from "@/lib/orderStatus";
import { PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/db/rows";
import {
  setOrderStatusAction,
  setPaymentStatusAction,
  addOrderNoteAction,
  sendInvoiceAction,
  setTrackingAction,
} from "../actions";
import { LBL, fmtDay, relativeTime, useOrderAction, useProofUpload, type Can, type Detail } from "./shared";

/** Linear lifecycle (branch/terminal states handled with dedicated buttons). */
const LIFECYCLE: OrderStatus[] = [
  "draft",
  "submitted",
  "in_review",
  "proof_ready",
  "changes_requested",
  "approved",
  "in_production",
  "quality_check",
  "shipped",
  "ready_for_pickup",
  "completed",
];

export function OrderRail({
  detail,
  can,
  pieces,
}: {
  detail: Detail;
  can: Can;
  pieces: number;
}) {
  const { order } = detail;
  const { toast } = useToast();
  const { pending, run } = useOrderAction();
  const { uploading, uploadProof } = useProofUpload(order.id);
  const proofInput = useRef<HTMLInputElement>(null);

  const status = order.status as OrderStatus;
  const currentIdx = LIFECYCLE.indexOf(status);
  const nextStatus = currentIdx >= 0 && currentIdx < LIFECYCLE.length - 1 ? LIFECYCLE[currentIdx + 1] : null;

  const pricing = (order.pricing ?? {}) as { total?: number };
  const total = pricing.total ?? 0;
  const [payment, setPayment] = useState(order.payment_status as PaymentStatus);
  const [tracking, setTracking] = useState(order.shipping_tracking ?? "");
  const [invoiceConfirm, setInvoiceConfirm] = useState(false);

  const paymentBadge: "success" | "info" | "warn" | "neutral" =
    payment === "paid_in_full" ? "success" : payment.startsWith("deposit") ? "info" : payment === "refunded" ? "neutral" : "warn";

  function goToStatus(target: OrderStatus) {
    if (target === status) return;
    const targetIdx = LIFECYCLE.indexOf(target);
    if (targetIdx >= 0 && currentIdx >= 0 && targetIdx < currentIdx) {
      if (!window.confirm(`Move backwards to “${STATUS_META[target].label}”?`)) return;
    }
    run(() => setOrderStatusAction(order.id, target), "Status updated");
  }

  function putOnHold() {
    const reason = window.prompt("Reason for hold (optional) — added as an internal comment:") ?? "";
    run(
      async () => {
        const r = await setOrderStatusAction(order.id, "on_hold");
        if (!r.error && reason.trim()) await addOrderNoteAction(order.id, `On hold: ${reason.trim()}`, "internal");
        return r;
      },
      "Order placed on hold",
    );
  }

  function sendInvoice() {
    run(() => sendInvoiceAction(order.id), order.invoice_sent_at ? "Invoice re-sent" : "Invoice sent");
  }

  function onSendInvoiceClick() {
    // Warn if the proof isn't approved yet.
    if (currentIdx >= 0 && currentIdx < LIFECYCLE.indexOf("approved")) {
      setInvoiceConfirm(true);
      return;
    }
    sendInvoice();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/o/${order.public_token}`);
      toast({ title: "Order link copied", variant: "success" });
    } catch {
      toast({ title: "Could not copy link", variant: "error" });
    }
  }

  return (
    <div className="space-y-4 lg:sticky lg:top-6">
      {/* Status pipeline */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Status</CardTitle>
          {can.edit && nextStatus && (
            <Button variant="primary" size="sm" loading={pending} onClick={() => goToStatus(nextStatus)}>
              Advance →
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-1">
          <ol className="space-y-0.5">
            {LIFECYCLE.map((s, i) => {
              const done = currentIdx >= 0 && i < currentIdx;
              const current = s === status;
              return (
                <li key={s}>
                  <button
                    type="button"
                    disabled={!can.edit}
                    onClick={() => goToStatus(s)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                      current ? "bg-dream-lavender-soft font-semibold text-dream-purple" : "text-dream-ink hover:bg-dream-bg",
                      !can.edit && "cursor-default hover:bg-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                        current
                          ? "border-dream-purple bg-dream-purple text-white"
                          : done
                            ? "border-dream-success bg-dream-success text-white"
                            : "border-dream-line-strong bg-white text-dream-faint",
                      )}
                    >
                      {done ? (
                        <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden>
                          <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    {STATUS_META[s].label}
                  </button>
                </li>
              );
            })}
          </ol>
          {can.edit && (
            <div className="flex flex-wrap gap-2 border-t border-dream-line pt-3">
              <Button
                variant={status === "on_hold" ? "secondary" : "ghost"}
                size="sm"
                disabled={status === "on_hold"}
                onClick={putOnHold}
              >
                Put on hold
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-dream-danger hover:bg-dream-danger-soft"
                disabled={status === "cancelled"}
                onClick={() => {
                  if (window.confirm("Cancel this order?")) goToStatus("cancelled");
                }}
              >
                Cancel order
              </Button>
            </div>
          )}
          {(status === "on_hold" || status === "cancelled") && (
            <div className="pt-1">
              <Badge variant={status === "on_hold" ? "warn" : "danger"}>{STATUS_META[status].label}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Payment</CardTitle>
          <Badge variant={paymentBadge}>{payment === "paid_in_full" ? "Paid" : payment.replace(/_/g, " ")}</Badge>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <Select
            value={payment}
            disabled={!can.edit}
            onChange={(e) => {
              const next = e.target.value as PaymentStatus;
              setPayment(next);
              run(() => setPaymentStatusAction(order.id, next), "Payment updated");
            }}
          >
            {PAYMENT_STATUSES.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </Select>

          <dl className="space-y-1 text-sm">
            {order.invoice_sent_at && (
              <div className="flex justify-between">
                <dt className="text-dream-muted">Invoice sent</dt>
                <dd className="text-dream-ink">{fmtDay(order.invoice_sent_at)}</dd>
              </div>
            )}
            {order.invoice_amount != null && (
              <div className="flex justify-between">
                <dt className="text-dream-muted">Invoiced</dt>
                <dd className="text-dream-ink">{formatCAD(order.invoice_amount)}</dd>
              </div>
            )}
            {order.paid_at && (
              <div className="flex justify-between">
                <dt className="text-dream-muted">Paid</dt>
                <dd className="text-dream-ink">{fmtDay(order.paid_at)}</dd>
              </div>
            )}
          </dl>

          {can.pricing && (
            <Button
              variant="primary"
              className="w-full"
              loading={pending}
              disabled={total <= 0}
              title={total <= 0 ? "Set an order total before invoicing" : undefined}
              onClick={onSendInvoiceClick}
            >
              {order.invoice_sent_at ? "Re-send invoice" : "Send invoice"}
            </Button>
          )}
          <Button variant="secondary" className="w-full" onClick={copyLink}>
            Copy order link
          </Button>
        </CardContent>
      </Card>

      {/* Shipping */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Shipping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="text-sm text-dream-muted">
            {order.fulfillment_method === "pickup" ? "Pick up in store" : "Ship to customer"}
            {order.shipping_method ? ` · ${order.shipping_method}` : ""}
          </div>
          <div>
            <div className={cn(LBL, "mb-1")}>Tracking number</div>
            <Input value={tracking} disabled={!can.edit} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 1Z…" />
          </div>
          {can.edit && (
            <Button
              variant="secondary"
              className="w-full"
              loading={pending}
              disabled={tracking === (order.shipping_tracking ?? "")}
              onClick={() => run(() => setTrackingAction(order.id, tracking), "Tracking saved")}
            >
              Save tracking
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Proofs */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Proofs</CardTitle>
          {can.proofs && (
            <>
              <Button variant="secondary" size="sm" loading={uploading} onClick={() => proofInput.current?.click()}>
                Upload mockup
              </Button>
              <input
                ref={proofInput}
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) uploadProof(f);
                }}
              />
            </>
          )}
        </CardHeader>
        <CardContent>
          {detail.proofs.length === 0 ? (
            <p className="text-sm text-dream-muted">No proofs sent yet.</p>
          ) : (
            <div className="space-y-3">
              {detail.proofs.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-dream-line p-2.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-dream-bg">
                    {p.image && <Image src={p.image} alt="" width={48} height={48} className="h-full w-full object-contain" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge variant={p.status === "approved" ? "success" : p.status === "changes_requested" ? "warn" : "info"}>
                      {p.status.replace(/_/g, " ")}
                    </Badge>
                    {p.change_request_comment && <p className="mt-1 text-xs text-dream-warn">“{p.change_request_comment}”</p>}
                  </div>
                  <div className="shrink-0 text-xs text-dream-faint">{relativeTime(p.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stat mini-block */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4">
          {[
            { label: "In hands", value: order.due_date ? fmtDay(order.due_date) : "—" },
            { label: "Total pieces", value: String(pieces) },
            { label: "Order value", value: formatCAD(total) },
            { label: "Sales rep", value: order.sales_rep ?? "—" },
          ].map((s) => (
            <div key={s.label}>
              <div className={LBL}>{s.label}</div>
              <div className="mt-0.5 truncate text-sm font-semibold text-dream-ink">{s.value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

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
                sendInvoice();
              }}
            >
              Send anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
