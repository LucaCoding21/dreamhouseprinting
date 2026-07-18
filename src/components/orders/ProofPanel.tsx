"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { formatCAD } from "@/lib/money";
import { StatusTag } from "@/components/portal/StatusTag";
import { IconZoom, IconClose, IconCheck } from "@/components/portal/icons";
import { PaymentMethodDialog } from "./PaymentMethodDialog";
import type { OrderViewProof, OrderViewActions, OrderViewEtransfer } from "./types";

/**
 * Customer proof review + approve / request-changes. Shared by the logged-in
 * portal and the public tokenized order page — it takes the decision server
 * actions as props (already bound to the order/token by the route) rather than
 * importing them, so the same UI drives both auth modes.
 */
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
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [payDialog, setPayDialog] = useState(false);

  // One decision covers the whole set; the primary proof drives status + id.
  const proof = proofs[0];
  const decided = proof.status === "approved";
  const changesRequested = proof.status === "changes_requested";
  const multiple = proofs.length > 1;

  function approve() {
    start(async () => {
      const r = await onApprove(proof.id);
      if (r.error) {
        setError(r.error);
        return;
      }
      if (payOnApprove) {
        // E-transfer configured: let them choose how to pay. The refresh behind
        // the dialog re-renders the approved state; the dialog itself is client
        // state and survives it.
        if (etransfer) {
          setPayDialog(true);
          router.refresh();
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
    <Card className="border-dream-purple">
      <CardHeader className="flex-row items-center gap-3">
        <CardTitle>{multiple ? `Your proofs are ready (${proofs.length})` : "Your proof is ready"}</CardTitle>
        <StatusTag tone={proof.status === "approved" ? "success" : proof.status === "changes_requested" ? "warn" : "purple"}>
          {proof.status.replace(/_/g, " ")}
        </StatusTag>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className={multiple ? "grid w-full shrink-0 grid-cols-2 gap-2 self-start sm:w-56" : "w-48 shrink-0 self-start"}>
            {proofs.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setZoomed(p.image)}
                className="group relative block overflow-hidden rounded-xl border border-dream-line bg-dream-bg"
                aria-label={`View proof ${i + 1} full size`}
              >
                {/* Proofs arrive at any aspect ratio — fix the width and let the box
                    grow to the image's natural height so there's never a grey band. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={`Proof ${i + 1}`} className="block h-auto w-full" />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-dream-ink/70 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-dream-purple/85">
                  <IconZoom className="h-3.5 w-3.5" />
                  {multiple ? `View ${i + 1}` : "View full size"}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-col">
            {decided ? (
              <p className="text-sm text-dream-success">
                You approved {multiple ? "these proofs" : "this proof"}. {multiple ? "They’re" : "It’s"} locked for production. 🎉
                {payOnApprove && (
                  <span className="mt-1 block text-dream-muted">One step left — complete your payment below and we’ll get printing.</span>
                )}
              </p>
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
                    <p className="mt-2 text-sm text-dream-ink">You asked: “{proof.change_request_comment}”</p>
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
                <p className="mb-3 text-sm text-dream-muted">
                  Review {multiple ? "every mockup" : "your mockup"} carefully: spelling, colours and placement. Approving covers
                  {multiple ? " all of them" : " it"}
                  {payOnApprove
                    ? etransfer
                      ? " and opens payment (card or Interac e-Transfer). Once paid, your order goes to production."
                      : " and takes you to secure checkout — once paid, your order goes to production."
                    : " — send to production, or tell us what to change."}
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
      </CardContent>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dream-ink/80 p-4 sm:p-8"
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setZoomed(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-[3px] bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <IconClose className="h-5 w-5" />
          </button>
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={zoomed}
              alt="Proof, full size"
              width={1400}
              height={1400}
              className="max-h-[85vh] w-auto rounded-lg bg-white object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      {etransfer && (
        <PaymentMethodDialog
          open={payDialog}
          onOpenChange={setPayDialog}
          amountDue={amountDue}
          orderNumber={orderNumber}
          etransfer={etransfer}
          payNow={onPayNow}
          reportEtransfer={onReportEtransfer}
          onReported={() => router.refresh()}
        />
      )}
    </Card>
  );
}
