"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { ProofLightbox, fileKind } from "./ProofLightbox";
import { useProofUpload } from "./shared";

interface Selected {
  file: File;
  url: string;
  kind: "image" | "pdf";
}

/**
 * Review-before-send gate for proofs. Picking a file no longer fires the
 * customer email instantly — instead the chosen artwork is shown large (with a
 * fullscreen check) alongside who it'll be emailed to, and only "Send to
 * customer" uploads + notifies. Preview is the exact local file, so it's WYSIWYG.
 */
export function ProofReviewDialog({
  orderId,
  lineItemId,
  open,
  onOpenChange,
  orderNumber,
  customerName,
  contextLabel,
  isReplacement,
}: {
  orderId: string;
  lineItemId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string | null;
  customerName: string;
  /** e.g. the line item's product name, so multi-item orders are unambiguous. */
  contextLabel?: string;
  /** changes_requested / re-proof — tweaks the copy. */
  isReplacement?: boolean;
}) {
  const { uploading, uploadProof } = useProofUpload(orderId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Revoke the current object URL on unmount (no setState in the body → no
  // cascading-render lint; all state changes happen in event handlers).
  useEffect(() => () => {
    if (selected) URL.revokeObjectURL(selected.url);
  }, [selected]);

  function choose(f: File | undefined | null) {
    if (!f) return;
    if (selected) URL.revokeObjectURL(selected.url);
    setSelected({ file: f, url: URL.createObjectURL(f), kind: fileKind(f.type || f.name) });
  }

  function reset() {
    if (selected) URL.revokeObjectURL(selected.url);
    setSelected(null);
    setDragging(false);
    setFullscreen(false);
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function send() {
    if (!selected) return;
    const r = await uploadProof(selected.file, lineItemId);
    if (r.ok) close(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-2xl" backdropClassName="bg-dream-ink/40 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>{isReplacement ? "Send a new proof" : "Review proof before sending"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-5">
            {/* Who it's going to — confirm the right order before sending. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-dream-bg px-3 py-2 text-sm">
              <span className="text-dream-muted">Emails</span>
              <span className="font-semibold text-dream-ink">{customerName}</span>
              <span className="text-dream-faint">·</span>
              <span className="text-dream-muted">Order</span>
              <span className="font-semibold text-dream-ink">{orderNumber ?? "—"}</span>
              {contextLabel && (
                <>
                  <span className="text-dream-faint">·</span>
                  <span className="text-dream-ink">{contextLabel}</span>
                </>
              )}
            </div>

            {!selected ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  choose(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                  dragging ? "border-dream-purple bg-dream-lavender-soft" : "border-dream-line-strong hover:border-dream-purple hover:bg-dream-bg",
                )}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-dream-purple" aria-hidden>
                  <path d="M12 16V4M7 9l5-5 5 5" />
                  <path d="M20 16v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3" />
                </svg>
                <span className="font-medium text-dream-ink">Drop the proof here, or click to browse</span>
                <span className="text-xs text-dream-muted">PNG, JPG, or PDF</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-dream-line bg-[repeating-conic-gradient(var(--color-dream-bg)_0%_25%,transparent_0%_50%)] [background-size:20px_20px]">
                  {selected.kind === "pdf" ? (
                    <div className="flex h-72 flex-col items-center justify-center gap-2 bg-dream-surface text-dream-muted">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10" aria-hidden>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                      <span className="text-sm font-medium text-dream-ink">{selected.file.name}</span>
                      <span className="text-xs">PDF — open fullscreen to review</span>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setFullscreen(true)} className="group block w-full" title="Click to view fullscreen">
                      <Image
                        src={selected.url}
                        alt="Proof preview"
                        width={1200}
                        height={800}
                        unoptimized
                        className="mx-auto max-h-72 w-auto object-contain"
                      />
                      <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-dream-ink/70 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                        Click to enlarge
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate text-sm text-dream-muted" title={selected.file.name}>
                    {selected.file.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setFullscreen(true)} className="inline-flex items-center gap-1 text-sm text-dream-purple hover:underline">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                        <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                      </svg>
                      Fullscreen
                    </button>
                    <button type="button" onClick={() => inputRef.current?.click()} className="text-sm text-dream-purple hover:underline">
                      Choose different
                    </button>
                  </div>
                </div>

                <p className="rounded-lg border border-dream-warn/30 bg-dream-warn-soft px-3 py-2 text-xs text-dream-warn">
                  The customer gets an email to approve this exact image. Double-check it&apos;s the right artwork and order.
                </p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                choose(f);
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={uploading} disabled={!selected} onClick={send}>
              Send to customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && (
        <ProofLightbox src={selected.url} kind={selected.kind} title={selected.file.name} open={fullscreen} onOpenChange={setFullscreen} />
      )}
    </>
  );
}
