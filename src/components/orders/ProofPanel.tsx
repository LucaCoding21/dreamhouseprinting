"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { StatusTag } from "@/components/portal/StatusTag";
import { IconZoom, IconClose } from "@/components/portal/icons";
import type { OrderViewProof, OrderViewActions } from "./types";

/**
 * Customer proof review + approve / request-changes. Shared by the logged-in
 * portal and the public tokenized order page — it takes the decision server
 * actions as props (already bound to the order/token by the route) rather than
 * importing them, so the same UI drives both auth modes.
 */
export function ProofPanel({
  proof,
  onApprove,
  onRequestChanges,
}: {
  proof: OrderViewProof;
  onApprove: OrderViewActions["approveProof"];
  onRequestChanges: OrderViewActions["requestChanges"];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [requesting, setRequesting] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const decided = proof.status === "approved";

  return (
    <Card className="border-dream-purple">
      <CardHeader className="flex-row items-center gap-3">
        <CardTitle>Your proof is ready</CardTitle>
        <StatusTag tone={proof.status === "approved" ? "success" : proof.status === "changes_requested" ? "warn" : "purple"}>
          {proof.status.replace(/_/g, " ")}
        </StatusTag>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="group relative block w-48 shrink-0 self-start overflow-hidden rounded-xl border border-dream-line bg-dream-bg"
            aria-label="View proof full size"
          >
            {/* Proofs arrive at any aspect ratio — fix the width and let the box
                grow to the image's natural height so there's never a grey band. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proof.image} alt="Proof" className="block h-auto w-full" />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-dream-ink/70 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-dream-purple/85">
              <IconZoom className="h-3.5 w-3.5" />
              View full size
            </span>
          </button>
          <div className="flex flex-1 flex-col">
            {decided ? (
              <p className="text-sm text-dream-success">You approved this proof. It’s locked for production. 🎉</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-dream-muted">
                  Review your mockup carefully: spelling, colours and placement. Approve to send it to production, or tell us what to change.
                </p>
                {!requesting ? (
                  <div className="mt-auto flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={() => setRequesting(true)}>
                      Request changes
                    </Button>
                    <Button
                      variant="primary"
                      loading={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await onApprove(proof.id);
                          if (r.error) setError(r.error);
                          else router.refresh();
                        })
                      }
                    >
                      Approve proof
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
                        onClick={() =>
                          start(async () => {
                            const r = await onRequestChanges(proof.id, comment);
                            if (r.error) setError(r.error);
                            else router.refresh();
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
                {proof.change_request_comment && (
                  <p className="mt-2 text-sm text-dream-warn">You asked: “{proof.change_request_comment}”</p>
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
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-[3px] bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <IconClose className="h-5 w-5" />
          </button>
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={proof.image}
              alt="Proof, full size"
              width={1400}
              height={1400}
              className="max-h-[85vh] w-auto rounded-lg bg-white object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
