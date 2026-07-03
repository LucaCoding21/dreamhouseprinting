"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCAD } from "@/lib/money";
import type { OrderViewActions } from "./types";

/**
 * Invoice + payment panel. Rendered on BOTH the portal and the public order
 * page once Julian has sent the invoice (invoice_sent_at set). When paid it
 * shows a settled state; otherwise a rough-pill "Pay now" CTA that mints a
 * Stripe Checkout session via the payNow action and redirects to it.
 */
export function InvoicePanel({
  invoiceSentAt,
  amountDue,
  paidAt,
  payNow,
}: {
  invoiceSentAt: string;
  amountDue: number;
  paidAt: string | null;
  payNow: OrderViewActions["payNow"];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  return (
    <Card className="border-dream-purple">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Invoice</CardTitle>
        {paidAt ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-dream-success-soft px-3 py-1 text-xs font-semibold text-dream-success">
            Paid
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm text-dream-muted">
              {paidAt ? "Amount paid" : "Total due"}
            </div>
            <div className="mt-0.5 font-display text-3xl font-bold text-dream-ink">
              {formatCAD(amountDue)}
            </div>
            <p className="mt-1 text-xs text-dream-muted">
              {paidAt
                ? `Paid ${fmtDate(paidAt)}. Thank you!`
                : `Invoice sent ${fmtDate(invoiceSentAt)}`}
            </p>
          </div>

          {!paidAt && (
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await payNow();
                    if (r.url) window.location.assign(r.url);
                    else setError(r.error ?? "Could not start checkout. Please try again.");
                  })
                }
                className="rough-pill rough-pill-filled inline-flex items-center justify-center px-7 py-3 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-70"
              >
                {pending ? "Starting checkout…" : "Pay now"}
              </button>
              {error && <p className="text-sm text-dream-danger">{error}</p>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
