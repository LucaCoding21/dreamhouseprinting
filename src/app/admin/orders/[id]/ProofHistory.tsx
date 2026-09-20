"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProofLightbox, fileKind } from "./ProofLightbox";
import { relativeTime, type Detail } from "./shared";
import type { ProofRow } from "@/lib/db/rows";

/** Proof send/approval history, an active-work item, lives near the lines. */
export function ProofHistory({ detail }: { detail: Detail }) {
  const [lightboxProof, setLightboxProof] = useState<ProofRow | null>(null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Proof history</CardTitle>
      </CardHeader>
      <CardContent>
        {detail.proofs.length === 0 ? (
          <p className="text-sm text-dream-muted">No proofs yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {detail.proofs.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-dream-line p-2.5">
                <button
                  type="button"
                  onClick={() => p.image && setLightboxProof(p)}
                  disabled={!p.image}
                  title="View fullscreen"
                  className="group relative h-12 w-12 shrink-0 overflow-hidden rounded bg-dream-bg"
                >
                  {p.image &&
                    (fileKind(p.image) === "pdf" ? (
                      <span className="flex h-full w-full flex-col items-center justify-center text-dream-muted">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                        </svg>
                        <span className="text-[9px] font-semibold">PDF</span>
                      </span>
                    ) : (
                      <Image src={p.image} alt="" width={48} height={48} className="h-full w-full object-contain" />
                    ))}
                  {/* Touch has no hover. Rather than dim a 48px thumb
                      permanently, the scrim stays a md-hover affordance and
                      phones get a corner glyph that leaves the proof visible. */}
                  <span className="absolute inset-0 hidden items-center justify-center bg-dream-ink/50 opacity-0 transition-opacity md:flex md:group-hover:opacity-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-white" aria-hidden>
                      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                    </svg>
                  </span>
                  {p.image && (
                    <span className="absolute bottom-0 right-0 flex items-center justify-center rounded-tl bg-dream-ink/70 p-0.5 md:hidden">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-white" aria-hidden>
                        <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                      </svg>
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <Badge variant={p.status === "approved" ? "success" : p.status === "changes_requested" ? "warn" : p.status === "pending" && detail.order.status !== "proof_ready" ? "neutral" : "info"}>
                    {p.status === "pending"
                      ? detail.order.status === "proof_ready"
                        ? "awaiting approval"
                        : "not sent yet"
                      : p.status.replace(/_/g, " ")}
                  </Badge>
                  {p.change_request_comment && <p className="mt-1 text-xs text-dream-warn">“{p.change_request_comment}”</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  {p.image && (
                    // New tab: the real file opens in the browser's own viewer
                    // (PDFs included) and the order page keeps its place.
                    <a
                      href={p.image}
                      target="_blank"
                      rel="noopener"
                      className="py-1 text-xs font-medium text-dream-purple hover:underline"
                    >
                      View proof
                    </a>
                  )}
                  <span className="text-xs text-dream-faint">{relativeTime(p.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {lightboxProof?.image && (
        <ProofLightbox
          src={lightboxProof.image}
          kind={fileKind(lightboxProof.image)}
          title={`Proof · ${lightboxProof.status.replace(/_/g, " ")}`}
          open={!!lightboxProof}
          onOpenChange={(o) => !o && setLightboxProof(null)}
        />
      )}
    </Card>
  );
}
