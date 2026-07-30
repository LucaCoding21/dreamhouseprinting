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
                  {p.image && <Image src={p.image} alt="" width={48} height={48} className="h-full w-full object-contain" />}
                  <span className="absolute inset-0 flex items-center justify-center bg-dream-ink/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-white" aria-hidden>
                      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                    </svg>
                  </span>
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
                <div className="shrink-0 text-xs text-dream-faint">{relativeTime(p.created_at)}</div>
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
