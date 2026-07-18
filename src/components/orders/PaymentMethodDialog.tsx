"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { formatCAD } from "@/lib/money";
import type { OrderViewActions, OrderViewEtransfer } from "./types";

export type PaymentDialogStep = "choose" | "etransfer" | "sent";

/**
 * "How would you like to pay?" modal, shared by the proof approve flow and the
 * Payment panel's Pay button. Card goes straight to Stripe Checkout; Interac
 * e-Transfer shows send-it-yourself instructions and a "I've sent it" button
 * that flags the order for admin verification (the order stays unpaid until
 * Julian confirms the deposit landed). Only rendered when e-transfer is
 * configured: card-only shops keep the direct-to-Stripe flow with no dialog.
 */
export function PaymentMethodDialog({
  open,
  onOpenChange,
  amountDue,
  orderNumber,
  etransfer,
  payNow,
  reportEtransfer,
  onReported,
  initialStep = "choose",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountDue: number;
  orderNumber: string | null;
  etransfer: OrderViewEtransfer;
  payNow: OrderViewActions["payNow"];
  reportEtransfer: OrderViewActions["reportEtransfer"];
  /** Called after "I've sent it" succeeds and the dialog is dismissed. */
  onReported: () => void;
  /** Open directly on the transfer instructions (e.g. "View transfer details"). */
  initialStep?: PaymentDialogStep;
}) {
  const [step, setStep] = useState<PaymentDialogStep>(initialStep);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Re-opening always starts fresh at the requested step (state adjusted
  // during render, per React's "you might not need an effect" guidance).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep(initialStep);
      setError(null);
    }
  }

  function payByCard() {
    start(async () => {
      setError(null);
      const r = await payNow();
      if (r.url) {
        window.location.assign(r.url);
        return;
      }
      setError(r.error ?? "Could not start card checkout. Please try again.");
    });
  }

  function sentIt() {
    start(async () => {
      setError(null);
      const r = await reportEtransfer();
      if (r.error) {
        setError(r.error);
        return;
      }
      setStep("sent");
    });
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next && step === "sent") onReported();
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent backdropClassName="bg-dream-overlay/40">
        <DialogClose />

        {step === "choose" && (
          <>
            <DialogHeader>
              <DialogTitle>How would you like to pay?</DialogTitle>
              <DialogDescription>
                {formatCAD(amountDue)} for order {orderNumber ?? "your order"}. Both ways work great, pick whichever is
                easier for you.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 p-5 pt-2">
              <button
                type="button"
                disabled={pending}
                onClick={payByCard}
                className="group flex w-full items-center gap-4 rounded-xl border-2 border-dream-line bg-white p-4 text-left transition-colors hover:border-dream-purple hover:bg-dream-lavender-mist disabled:opacity-60"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-dream-lavender-soft text-dream-purple">
                  <IconCard className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-bold text-dream-ink">Debit or credit card</span>
                  <span className="block text-sm text-dream-muted">
                    {pending ? "Starting secure checkout…" : "Secure checkout with Stripe, confirmed instantly."}
                  </span>
                </span>
                <IconChevron className="h-4 w-4 shrink-0 text-dream-faint transition-transform group-hover:translate-x-0.5 group-hover:text-dream-purple" />
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() => setStep("etransfer")}
                className="group flex w-full items-center gap-4 rounded-xl border-2 border-dream-line bg-white p-4 text-left transition-colors hover:border-dream-purple hover:bg-dream-lavender-mist disabled:opacity-60"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-dream-sun-soft text-dream-ink">
                  <IconSend className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-bold text-dream-ink">Interac e-Transfer</span>
                  <span className="block text-sm text-dream-muted">
                    Send it from your banking app. We confirm it, then start printing.
                  </span>
                </span>
                <IconChevron className="h-4 w-4 shrink-0 text-dream-faint transition-transform group-hover:translate-x-0.5 group-hover:text-dream-purple" />
              </button>

              {error && <p className="text-sm text-dream-danger">{error}</p>}
            </div>
          </>
        )}

        {step === "etransfer" && (
          <>
            <DialogHeader>
              <DialogTitle>Pay by Interac e-Transfer</DialogTitle>
              <DialogDescription>
                Send it from your banking app, then let us know below. We&rsquo;ll confirm it (usually within 1 business
                day) and get your order moving.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 p-5 pt-2">
              <div className="rounded-xl bg-dream-sun-soft/60 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-dream-ink-soft">Amount to send</div>
                <div className="font-display text-2xl font-bold text-dream-ink">{formatCAD(amountDue)}</div>
              </div>

              <CopyRow label="Send to" value={etransfer.email} />
              {orderNumber && (
                <CopyRow label="Message / memo" value={orderNumber} hint="So we can match it to your order" />
              )}

              {etransfer.note && <p className="text-sm text-dream-muted">{etransfer.note}</p>}
              {error && <p className="text-sm text-dream-danger">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" disabled={pending} onClick={() => setStep("choose")}>
                Back
              </Button>
              <Button variant="primary" loading={pending} onClick={sentIt}>
                I&rsquo;ve sent the e-transfer
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "sent" && (
          <>
            <DialogHeader>
              <DialogTitle>Thanks! We&rsquo;re watching for it</DialogTitle>
              <DialogDescription>
                We&rsquo;ll confirm your e-transfer of {formatCAD(amountDue)} as soon as it lands, then start on your
                order right away. You&rsquo;ll get an email the moment it&rsquo;s confirmed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="primary" onClick={() => close(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Labelled value with a copy-to-clipboard button ("Copied!" flash). */
function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (http, permissions): the value is selectable text.
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-dream-line bg-dream-bg px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-dream-muted">{label}</div>
        <div className="truncate font-medium text-dream-ink">{value}</div>
        {hint && <div className="text-xs text-dream-faint">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg border border-dream-line bg-white px-3 py-1.5 text-xs font-semibold text-dream-ink transition-colors hover:border-dream-purple hover:text-dream-purple"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function IconCard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <path d="M6 15h4" strokeLinecap="round" />
    </svg>
  );
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M21 3L10.5 13.5" strokeLinecap="round" />
      <path d="M21 3l-6.5 18-4-7.5L3 9.5 21 3z" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M6 3.5L10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
