"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { formatCAD } from "@/lib/money";
import { StatusTag } from "@/components/portal/StatusTag";
import { IconZoom, IconClose, IconCheck } from "@/components/portal/icons";
import { OrderPanel } from "./OrderPanel";
import { PaymentMethodDialog } from "./PaymentMethodDialog";
import type { OrderViewProof, OrderViewActions, OrderViewEtransfer } from "./types";

/**
 * Customer proof review + approve / request-changes. Shared by the logged-in
 * portal and the public tokenized order page, it takes the decision server
 * actions as props (already bound to the order/token by the route) rather than
 * importing them, so the same UI drives both auth modes.
 */

/** Signed Storage URLs keep the original filename before the ?token, so the
 *  extension is a reliable PDF signal. */
function isPdf(src: string): boolean {
  return /\.pdf(\?|#|$)/i.test(src);
}

export function ProofPanel({
  proofs,
  onApprove,
  onRequestChanges,
  onPayNow,
  onReportEtransfer,
  payOnApprove,
  amountDue,
  orderNumber,
  etransfer,
}: {
  proofs: OrderViewProof[];
  onApprove: OrderViewActions["approveProof"];
  onRequestChanges: OrderViewActions["requestChanges"];
  onPayNow: OrderViewActions["payNow"];
  onReportEtransfer: OrderViewActions["reportEtransfer"];
  /** Approve-and-pay: approving flows straight into payment for amountDue. */
  payOnApprove: boolean;
  amountDue: number;
  orderNumber: string | null;
  /** When set, approving opens the card / e-transfer chooser instead of going straight to Stripe. */
  etransfer: OrderViewEtransfer | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [requesting, setRequesting] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Lightbox: index into `proofs` of the open image, or null when closed.
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [payDialog, setPayDialog] = useState(false);

  // One decision covers the whole set; the primary proof drives status + id.
  const proof = proofs[0];
  // OrderView takes this panel down once the set is approved (approved proofs
  // live on their line items now), so this branch is a safety net for any other
  // caller, not the normal path.
  const decided = proof.status === "approved";
  const changesRequested = proof.status === "changes_requested";
  const multiple = proofs.length > 1;

  // Lightbox keyboard nav: Esc closes, Left/Right flip through the proof set.
  useEffect(() => {
    if (zoomIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomIndex(null);
      else if (e.key === "ArrowLeft") setZoomIndex((i) => (i === null ? i : (i - 1 + proofs.length) % proofs.length));
      else if (e.key === "ArrowRight") setZoomIndex((i) => (i === null ? i : (i + 1) % proofs.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIndex, proofs.length]);

  function approve() {
    start(async () => {
      const r = await onApprove(proof.id);
      if (r.error) {
        setError(r.error);
        return;
      }
      if (payOnApprove) {
        // E-transfer configured: open the card / e-transfer chooser as part of
        // THIS same click. No router.refresh() here, a concurrent server
        // refetch races the dialog opening. We refresh when the chooser closes
        // (see the dialog's onOpenChange) so the approved state shows then.
        if (etransfer) {
          setPayDialog(true);
          return;
        }
        // Card only: straight into Stripe Checkout. If the session can't be
        // minted (e.g. Stripe unconfigured) fall back to refreshing: the
        // payment panel below takes over with its own Pay button.
        const pay = await onPayNow();
        if (pay.url) {
          window.location.assign(pay.url);
          return;
        }
      }
      router.refresh();
    });
  }

  return (
    <OrderPanel
      title={multiple ? `Your proofs are ready (${proofs.length})` : "Your proof is ready"}
      tag={
        <StatusTag
          tone={proof.status === "approved" ? "success" : proof.status === "changes_requested" ? "warn" : "purple"}
          className="capitalize"
        >
          {proof.status.replace(/_/g, " ")}
        </StatusTag>
      }
    >
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className={multiple ? "grid w-full shrink-0 grid-cols-2 gap-2 self-start sm:w-56" : "w-48 shrink-0 self-start"}>
            {proofs.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setZoomIndex(i)}
                className="group relative block w-full overflow-hidden rounded-2xl border-2 border-dream-ink/10 bg-dream-bg"
                aria-label={`View proof ${i + 1} full size`}
              >
                {isPdf(p.image) ? (
                  /* PDFs can't render as <img>, show a labelled document tile. */
                  <span className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 text-dream-muted">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-9 w-9" aria-hidden>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                    <span className="text-[14px] font-semibold">PDF proof</span>
                  </span>
                ) : (
                  /* Proofs arrive at any aspect ratio, fix the width and let the box
                      grow to the image's natural height so there's never a grey band. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.image} alt={`Proof ${i + 1}`} className="block h-auto w-full" />
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-dream-ink/70 py-1.5 text-[14px] font-semibold text-white transition-colors group-hover:bg-dream-purple/85">
                  <IconZoom className="h-3.5 w-3.5" />
                  {multiple ? `View ${i + 1}` : "View full size"}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-col">
            {decided ? (
              <div className="rounded-2xl bg-dream-success-soft p-4 ring-1 ring-dream-success/25">
                <p className="flex items-start gap-2 text-sm font-semibold text-dream-success">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    You approved {multiple ? "these proofs" : "this proof"}. {multiple ? "They’re" : "It’s"} locked for
                    production. 🎉
                  </span>
                </p>
                <p className="mt-2 flex items-start gap-2 text-sm text-dream-muted">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <span>Spotted something off? Reach out as soon as possible and we’ll help.</span>
                </p>
                <div className="mt-3">
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-1.5 rounded-full border border-dream-line bg-white px-4 py-2 font-display text-sm font-bold text-dream-ink transition-colors hover:border-dream-purple hover:text-dream-purple"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 5h16v12H8l-4 4z" />
                    </svg>
                    Contact us
                  </Link>
                </div>
              </div>
            ) : changesRequested && !requesting ? (
              <div className="flex flex-1 flex-col">
                <div className="rounded-xl border border-dream-success/40 bg-dream-success/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-dream-success">
                    <IconCheck className="h-4 w-4" />
                    Change request sent!
                  </p>
                  <p className="mt-1 text-sm text-dream-muted">
                    Julian will review your notes and send an updated proof. We’ll email you when it’s ready.
                  </p>
                  {proof.change_request_comment && (
                    <p className="mt-2 break-words text-sm text-dream-ink">You asked: “{proof.change_request_comment}”</p>
                  )}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" onClick={() => setRequesting(true)}>
                    Add more notes
                  </Button>
                </div>
                {error && <p className="mt-2 text-sm text-dream-danger">{error}</p>}
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-dream-ink">
                  Give {multiple ? "every mockup" : "your mockup"} a once-over before you approve:
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {["Spelling and text", "Colours", "Placement and size"].map((c) => (
                    <li key={c} className="flex items-center gap-2 text-sm text-dream-muted">
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-dream-lavender-soft text-dream-purple">
                        <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 10.5l3.5 3.5L15 6.5" />
                        </svg>
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
                <p className="mb-3 mt-3 text-sm text-dream-muted">
                  {payOnApprove
                    ? etransfer
                      ? "Approving opens payment (card or Interac e-Transfer). Once paid, your order goes to production."
                      : "Approving takes you to secure checkout. Once paid, your order goes to production."
                    : "Approving sends it to production. Otherwise, tell us what to change."}
                </p>
                {!requesting ? (
                  <div className="mt-auto flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={() => setRequesting(true)}>
                      Request changes
                    </Button>
                    <Button variant="primary" loading={pending} onClick={approve}>
                      {payOnApprove ? `Approve & pay ${formatCAD(amountDue)}` : "Approve proof"}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-auto space-y-2">
                    <Textarea
                      rows={3}
                      placeholder="What would you like changed?"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="primary"
                        loading={pending}
                        disabled={!comment.trim()}
                        onClick={() =>
                          start(async () => {
                            const r = await onRequestChanges(proof.id, comment);
                            if (r.error) {
                              setError(r.error);
                            } else {
                              // Clear the box and drop out of edit mode so the
                              // refreshed "changes_requested" state reads as sent,
                              // not as an untouched form.
                              setComment("");
                              setRequesting(false);
                              setError(null);
                              router.refresh();
                            }
                          })
                        }
                      >
                        Send request
                      </Button>
                      <Button variant="ghost" onClick={() => setRequesting(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {error && <p className="mt-2 text-sm text-dream-danger">{error}</p>}
              </>
            )}
          </div>
        </div>

      {zoomIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dream-overlay/90 backdrop-blur-sm p-4 sm:p-8"
          onClick={() => setZoomIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setZoomIndex(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-[3px] bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <IconClose className="h-5 w-5" />
          </button>

          {multiple && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomIndex((i) => (i === null ? i : (i - 1 + proofs.length) % proofs.length));
                }}
                className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-6"
                aria-label="Previous proof"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomIndex((i) => (i === null ? i : (i + 1) % proofs.length));
                }}
                className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6"
                aria-label="Next proof"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          <div className="relative max-h-full w-fit max-w-full sm:max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {isPdf(proofs[zoomIndex].image) ? (
              <iframe
                src={proofs[zoomIndex].image}
                title={`Proof ${zoomIndex + 1}, full size`}
                className="h-[85vh] w-[85vw] max-w-4xl rounded-lg bg-white shadow-2xl"
              />
            ) : (
              <Image
                src={proofs[zoomIndex].image}
                alt={`Proof ${zoomIndex + 1}, full size`}
                width={1400}
                height={1400}
                className="max-h-[85dvh] w-auto max-w-full rounded-lg bg-white object-contain shadow-2xl"
              />
            )}
            {multiple && (
              <div className="absolute inset-x-0 -bottom-8 text-center text-sm font-semibold text-white/90">
                {zoomIndex + 1} / {proofs.length}
              </div>
            )}
          </div>
        </div>
      )}

      {etransfer && (
        <PaymentMethodDialog
          open={payDialog}
          onOpenChange={(o) => {
            setPayDialog(o);
            // Chooser dismissed after approval, pull the now-approved state in.
            if (!o) router.refresh();
          }}
          amountDue={amountDue}
          orderNumber={orderNumber}
          etransfer={etransfer}
          payNow={onPayNow}
          reportEtransfer={onReportEtransfer}
          onReported={() => router.refresh()}
        />
      )}
    </OrderPanel>
  );
}
