"use client";

import { useState } from "react";
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
import { EtransferVerify } from "./EtransferVerify";
import { LBL, SHIP_ON_TRACKING, fmtDay, useOrderAction, type Can, type Detail } from "./shared";

const PRE_APPROVAL = new Set<string>(["draft", "submitted", "in_review", "proof_ready", "changes_requested"]);

/** Bottom reference cluster: payment, shipping/tracking, and the stat mini-block. */
export function OrderReference({ detail, can, pieces }: { detail: Detail; can: Can; pieces: number }) {
  const { order } = detail;
  const { pending, run } = useOrderAction();

  const status = order.status as OrderStatus;
  const pricing = (order.pricing ?? {}) as { total?: number };
  const total = pricing.total ?? 0;

  const [payment, setPayment] = useState(order.payment_status as PaymentStatus);
  const [tracking, setTracking] = useState(order.shipping_tracking ?? "");
  const [invoiceConfirm, setInvoiceConfirm] = useState(false);

  const paymentBadge: "success" | "info" | "warn" | "neutral" =
    payment === "paid_in_full" ? "success" : payment.startsWith("deposit") ? "info" : payment === "refunded" ? "neutral" : "warn";

  // The customer said their e-transfer is on the way; Julian verifies it here.
  const etransferPending = !!order.etransfer_reported_at && !order.paid_at;
  const methodLabel =
    order.payment_method === "etransfer" ? "Interac e-Transfer" : order.payment_method === "card" ? "Card (Stripe)" : null;

  function sendInvoice() {
    run(() => sendInvoiceAction(order.id), order.invoice_sent_at ? "Payment link re-sent" : "Payment link emailed");
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
    run(() => setTrackingAction(order.id, tracking), willShip ? "Tracking saved, order marked shipped" : "Tracking saved");
  }

  return (
    <>
      {/* Payment */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Payment</CardTitle>
          <Badge variant={paymentBadge}>{payment === "paid_in_full" ? "Paid" : payment.replace(/_/g, " ")}</Badge>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {etransferPending && can.edit && (
            <EtransferVerify
              orderId={order.id}
              amount={total}
              reportedAt={order.etransfer_reported_at!}
              orderStatus={status}
            />
          )}

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
            {methodLabel && (
              <div className="flex justify-between">
                <dt className="text-dream-muted">Method</dt>
                <dd className="text-dream-ink">{methodLabel}</dd>
              </div>
            )}
            {order.etransfer_reported_at && !order.paid_at && (
              <div className="flex justify-between">
                <dt className="text-dream-muted">E-transfer reported</dt>
                <dd className="text-dream-ink">{fmtDay(order.etransfer_reported_at)}</dd>
              </div>
            )}
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
            <>
              <Button
                variant="primary"
                className="w-full"
                loading={pending}
                disabled={total <= 0}
                title={total <= 0 ? "Set an order total before invoicing" : undefined}
                onClick={onSendInvoiceClick}
              >
                {order.invoice_sent_at ? "Re-send payment link" : "Email payment link"}
              </Button>
              <p className="text-[11px] text-dream-faint">
                Optional — the customer is asked to pay as soon as they approve their proof. This emails the invoice with a
                payment link (always for the current total). A Customer-visible comment above goes out with it.
              </p>
            </>
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
    </>
  );
}
