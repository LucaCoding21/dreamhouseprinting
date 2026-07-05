"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { STATUS_META } from "@/lib/orderStatus";
import { PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/db/rows";
import { setPaymentStatusAction, sendInvoiceAction, setTrackingAction } from "../actions";
import { CustomerCard } from "./CustomerCard";
import { ProofLightbox, fileKind } from "./ProofLightbox";
import { LBL, SHIP_ON_TRACKING, fmtDay, relativeTime, useOrderAction, type Can, type Detail } from "./shared";
import type { ProofRow } from "@/lib/db/rows";

const PRE_APPROVAL = new Set<string>(["draft", "submitted", "in_review", "proof_ready", "changes_requested"]);

export function OrderRail({ detail, can, pieces }: { detail: Detail; can: Can; pieces: number }) {
  const { order } = detail;
  const { pending, run } = useOrderAction();

  const status = order.status as OrderStatus;
  const pricing = (order.pricing ?? {}) as { total?: number };
  const total = pricing.total ?? 0;

  const [payment, setPayment] = useState(order.payment_status as PaymentStatus);
  const [tracking, setTracking] = useState(order.shipping_tracking ?? "");
  const [invoiceConfirm, setInvoiceConfirm] = useState(false);
  const [lightboxProof, setLightboxProof] = useState<ProofRow | null>(null);

  const paymentBadge: "success" | "info" | "warn" | "neutral" =
    payment === "paid_in_full" ? "success" : payment.startsWith("deposit") ? "info" : payment === "refunded" ? "neutral" : "warn";

  function sendInvoice() {
    run(() => sendInvoiceAction(order.id), order.invoice_sent_at ? "Invoice re-sent" : "Invoice sent");
  }

  function onSendInvoiceClick() {
    if (PRE_APPROVAL.has(status)) {
      setInvoiceConfirm(true);
      return;
    }
    sendInvoice();
  }

  function saveTracking() {
    const willShip = tracking.trim() !== "" && order.fulfillment_method === "ship" && SHIP_ON_TRACKING.has(status);
    run(() => setTrackingAction(order.id, tracking), willShip ? "Tracking saved — order marked shipped" : "Tracking saved");
  }

  return (
    <div className="space-y-4 lg:sticky lg:top-6">
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
              onClick={saveTracking}
            >
              Save tracking
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Customer */}
      <CustomerCard detail={detail} canEdit={can.edit} />

      {/* Proof history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Proof history</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.proofs.length === 0 ? (
            <p className="text-sm text-dream-muted">No proofs sent yet.</p>
          ) : (
            <div className="space-y-3">
              {detail.proofs.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-dream-line p-2.5">
                  <button
                    type="button"
                    onClick={() => p.image && setLightboxProof(p)}
                    disabled={!p.image}
                    title="View fullscreen"
                    className="group relative h-12 w-12 shrink-0 overflow-hidden rounded bg-dream-bg"
                  >
                    {p.image && <Image src={p.image} alt="" width={48} height={48} className="h-full w-full object-contain" />}
                    <span className="absolute inset-0 flex items-center justify-center bg-dream-ink/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-white" aria-hidden>
                        <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                      </svg>
                    </span>
                  </button>
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
        <CardContent className="grid grid-cols-3 gap-3 p-4">
          {[
            { label: "In hands", value: order.due_date ? fmtDay(order.due_date) : "—" },
            { label: "Total pieces", value: String(pieces) },
            { label: "Order value", value: formatCAD(total) },
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

      {lightboxProof?.image && (
        <ProofLightbox
          src={lightboxProof.image}
          kind={fileKind(lightboxProof.image)}
          title={`Proof · ${lightboxProof.status.replace(/_/g, " ")}`}
          open={!!lightboxProof}
          onOpenChange={(o) => !o && setLightboxProof(null)}
        />
      )}
    </div>
  );
}
