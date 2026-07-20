"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCAD } from "@/lib/money";
import { PaymentMethodDialog, type PaymentDialogStep } from "./PaymentMethodDialog";
import type { OrderViewActions, OrderViewEtransfer } from "./types";

/**
 * Payment strip. Rendered INSIDE the combined "Payment" box (alongside the cost
 * summary + total) once the order is payable, proof approved (approve-and-pay)
 * or an invoice was explicitly sent. No card wrapper and no amount figure of its
 * own: the box's Total is the amount. Three states: settled (paid), e-transfer
 * reported (verifying; card stays a fallback), and due. "Pay now" opens the
 * method chooser when e-transfer is configured, else goes straight to Stripe.
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
    <div>
        {paidAt ? (
          // Settled, a compact positive confirmation (the box Total is the amount).
          <div className="flex items-center gap-3 rounded-2xl bg-dream-success-soft px-4 py-3 ring-1 ring-dream-success/25">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-dream-success text-white">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 10.5l3.5 3.5L15 6.5" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-dream-ink">Payment received</div>
              <p className="text-xs text-dream-muted">
                Paid {fmtDate(paidAt)}
                {paymentMethod === "etransfer" ? " by Interac e-Transfer" : paymentMethod === "card" ? " by card" : ""}. Thank
                you!
              </p>
            </div>
          </div>
        ) : etransferPending ? (
          <div className="rounded-2xl bg-dream-warn-soft px-4 py-3 ring-1 ring-dream-warn/25">
            <p className="text-sm text-dream-ink">
              We&apos;re confirming your e-transfer (sent {fmtDate(etransferReportedAt!)}). We&apos;ll get printing as soon as
              it lands.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {etransfer && (
                <button
                  type="button"
                  onClick={() => openDialog("etransfer")}
                  className="rounded-full border border-dream-line bg-white px-4 py-2 font-display text-sm font-bold text-dream-ink transition-colors hover:border-dream-purple hover:text-dream-purple"
                >
                  View transfer details
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={payByCard}
                className="rounded-full border border-dream-line bg-white px-4 py-2 font-display text-sm font-bold text-dream-ink transition-colors hover:border-dream-purple hover:text-dream-purple disabled:opacity-70"
              >
                {pending ? "Starting checkout…" : "Pay by card instead"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() => (etransfer ? openDialog("choose") : payByCard())}
              className="rough-pill rough-pill-filled inline-flex w-full items-center justify-center px-6 py-3 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-70"
            >
              {pending ? "Starting checkout…" : `Pay ${formatCAD(amountDue)}`}
            </button>
            <p className="mt-2 text-center text-xs text-dream-muted">
              {invoiceSentAt ? `Invoice sent ${fmtDate(invoiceSentAt)}` : "Approved. Pay to send your order to production."}
            </p>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-dream-danger">{error}</p>}

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
    </div>
  );
}
