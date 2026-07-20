"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCAD } from "@/lib/money";
import { PaymentMethodDialog, type PaymentDialogStep } from "./PaymentMethodDialog";
import type { OrderViewActions, OrderViewEtransfer } from "./types";

/**
 * Loud balance-due strip pinned ABOVE the order tracker. Exists for the
 * admin-skipped-proof path: when an order goes straight to approved or
 * production with no proof to approve, nothing else on the page asks the
 * customer for money, and they read the tracker and leave. Hidden whenever a
 * pending proof is showing (ProofPanel's "Approve & pay" owns that moment) or
 * a reported e-transfer is being verified.
 */
export function BalanceDueBanner({
  amountDue,
  orderNumber,
  etransfer,
  payNow,
  reportEtransfer,
}: {
  amountDue: number;
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

  function payByCard() {
    start(async () => {
      setError(null);
      const r = await payNow();
      if (r.url) window.location.assign(r.url);
      else setError(r.error ?? "Could not start checkout. Please try again.");
    });
  }

  return (
    <div className="rounded-3xl border-2 border-dream-sun bg-dream-sun-soft/60 px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-extrabold text-dream-ink">
            Balance due: {formatCAD(amountDue)}
          </div>
          <p className="mt-0.5 text-sm text-dream-ink/80">
            Your order is confirmed. Complete payment so we can keep it moving.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (etransfer) {
              setDialogStep("choose");
              setDialogOpen(true);
            } else {
              payByCard();
            }
          }}
          className="rough-pill rough-pill-filled inline-flex items-center justify-center px-7 py-3 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-70"
        >
          {pending ? "Starting checkout…" : `Pay ${formatCAD(amountDue)}`}
        </button>
      </div>
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
