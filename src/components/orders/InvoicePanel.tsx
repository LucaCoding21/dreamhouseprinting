"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCAD } from "@/lib/money";
import { PaymentMethodDialog, type PaymentDialogStep } from "./PaymentMethodDialog";
import type { OrderViewActions, OrderViewEtransfer } from "./types";

/**
 * Payment panel. Rendered on BOTH the portal and the public order page once
 * the order is payable — proof approved (approve-and-pay) or an invoice was
 * explicitly sent. Three states: settled (paid), e-transfer reported (we're
 * verifying the deposit; card stays available as a fallback), and due. "Pay
 * now" opens the method chooser when e-transfer is configured, else goes
 * straight to Stripe Checkout at the CURRENT order total.
 */
export function InvoicePanel({
  invoiceSentAt,
  amountDue,
  paidAt,
  paymentMethod,
  etransferReportedAt,
  orderNumber,
  etransfer,
  payNow,
  reportEtransfer,
}: {
  invoiceSentAt: string | null;
  amountDue: number;
  paidAt: string | null;
  paymentMethod: string | null;
  etransferReportedAt: string | null;
  orderNumber: string | null;
  etransfer: OrderViewEtransfer | null;
  payNow: OrderViewActions["payNow"];
  reportEtransfer: OrderViewActions["reportEtransfer"];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<PaymentDialogStep>("choose");

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  const etransferPending = !paidAt && !!etransferReportedAt;

  function payByCard() {
    start(async () => {
      setError(null);
      const r = await payNow();
      if (r.url) window.location.assign(r.url);
      else setError(r.error ?? "Could not start checkout. Please try again.");
    });
  }

  function openDialog(step: PaymentDialogStep) {
    setDialogStep(step);
    setDialogOpen(true);
  }

  return (
    <Card className="border-dream-purple">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Payment</CardTitle>
        {paidAt ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-dream-success-soft px-3 py-1 text-xs font-semibold text-dream-success">
            Paid
          </span>
        ) : etransferPending ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-dream-warn-soft px-3 py-1 text-xs font-semibold text-dream-warn">
            Confirming e-transfer
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm text-dream-muted">{paidAt ? "Amount paid" : "Total due"}</div>
            <div className="mt-0.5 font-display text-3xl font-bold text-dream-ink">{formatCAD(amountDue)}</div>
            <p className="mt-1 text-xs text-dream-muted">
              {paidAt
                ? `Paid ${fmtDate(paidAt)}${paymentMethod === "etransfer" ? " by Interac e-Transfer" : paymentMethod === "card" ? " by card" : ""}. Thank you!`
                : etransferPending
                  ? `You told us your e-transfer was sent ${fmtDate(etransferReportedAt!)}. We'll confirm it as soon as it lands and get printing.`
                  : invoiceSentAt
                    ? `Invoice sent ${fmtDate(invoiceSentAt)}`
                    : "Proof approved — pay to send your order to production."}
            </p>
          </div>

          {!paidAt && (
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              {etransferPending ? (
                <div className="flex flex-wrap gap-2">
                  {etransfer && (
                    <button
                      type="button"
                      onClick={() => openDialog("etransfer")}
                      className="rounded-full border border-dream-line bg-white px-5 py-2.5 font-display text-sm font-bold text-dream-ink transition-colors hover:border-dream-purple hover:text-dream-purple"
                    >
                      View transfer details
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={payByCard}
                    className="rounded-full border border-dream-line bg-white px-5 py-2.5 font-display text-sm font-bold text-dream-ink transition-colors hover:border-dream-purple hover:text-dream-purple disabled:opacity-70"
                  >
                    {pending ? "Starting checkout…" : "Pay by card instead"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => (etransfer ? openDialog("choose") : payByCard())}
                  className="rough-pill rough-pill-filled inline-flex items-center justify-center px-7 py-3 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-70"
                >
                  {pending ? "Starting checkout…" : "Pay now"}
                </button>
              )}
              {error && <p className="text-sm text-dream-danger">{error}</p>}
            </div>
          )}
        </div>
      </CardContent>

      {etransfer && (
        <PaymentMethodDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          amountDue={amountDue}
          orderNumber={orderNumber}
          etransfer={etransfer}
          payNow={payNow}
          reportEtransfer={reportEtransfer}
          onReported={() => router.refresh()}
          initialStep={dialogStep}
        />
      )}
    </Card>
  );
}
