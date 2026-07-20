"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
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
 * customer email instantly, instead the chosen artwork is shown large (with a
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
  orderTotal,
}: {
  orderId: string;
  lineItemId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string | null;
  customerName: string;
  /** e.g. the line item's product name, so multi-item orders are unambiguous. */
  contextLabel?: string;
  /** changes_requested / re-proof, tweaks the copy. */
  isReplacement?: boolean;
  /** Current order total, approving triggers approve-and-pay, so warn when it's $0. */
  orderTotal?: number;
}) {
  const { uploading, uploadProofs } = useProofUpload(orderId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Selected | null>(null);

  // Revoke all object URLs on unmount (state changes only in event handlers).
  useEffect(() => () => {
    selected.forEach((s) => URL.revokeObjectURL(s.url));
  }, [selected]);

  function choose(files: FileList | File[] | null | undefined) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setSelected((prev) => [
      ...prev,
      ...list.map((f) => ({ file: f, url: URL.createObjectURL(f), kind: fileKind(f.type || f.name) })),
    ]);
  }

  function removeAt(i: number) {
    setSelected((prev) => {
      const s = prev[i];
      if (s) URL.revokeObjectURL(s.url);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function reset() {
    selected.forEach((s) => URL.revokeObjectURL(s.url));
    setSelected([]);
    setDragging(false);
    setPreview(null);
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function send() {
    if (selected.length === 0) return;
    const r = await uploadProofs(selected.map((s) => s.file), lineItemId);
    if (r.ok) close(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-2xl" backdropClassName="bg-dream-overlay/50 backdrop-blur-sm">
          <DialogClose />
          <DialogHeader>
            <DialogTitle>{isReplacement ? "Send a new proof" : "Review proof before sending"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-5">
            {/* Who it's going to, confirm the right order before sending. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-dream-bg px-3 py-2 text-sm">
              <span className="text-dream-muted">Emails</span>
              <span className="font-semibold text-dream-ink">{customerName}</span>
              <span className="text-dream-faint">·</span>
              <span className="text-dream-muted">Order</span>
              <span className="font-semibold text-dream-ink">{orderNumber ?? "-"}</span>
              {contextLabel && (
                <>
                  <span className="text-dream-faint">·</span>
                  <span className="text-dream-ink">{contextLabel}</span>
                </>
              )}
            </div>

            {orderTotal !== undefined && orderTotal <= 0 && (
              <p className="rounded-lg border border-dream-warn/30 bg-dream-warn-soft px-3 py-2 text-xs text-dream-warn">
                This order has no total yet. Approving the proof asks the customer to pay right away, so set the pricing
                before sending, otherwise they can approve but not pay.
              </p>
            )}

            {selected.length === 0 ? (
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
                  choose(e.dataTransfer.files);
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
                <span className="font-medium text-dream-ink">Drop proofs here, or click to browse</span>
                <span className="text-xs text-dream-muted">Add as many as you need, front, back, and so on. PNG, JPG, or PDF.</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    choose(e.dataTransfer.files);
                  }}
                  className={cn(
                    "grid grid-cols-2 gap-3 rounded-xl border-2 border-dashed p-3 transition-colors sm:grid-cols-3",
                    dragging ? "border-dream-purple bg-dream-lavender-soft" : "border-transparent",
                  )}
                >
                  {selected.map((s, i) => (
                    <div
                      key={s.url}
                      className="group relative overflow-hidden rounded-lg border border-dream-line bg-[repeating-conic-gradient(var(--color-dream-bg)_0%_25%,transparent_0%_50%)] [background-size:20px_20px]"
                    >
                      {s.kind === "pdf" ? (
                        <div className="flex h-32 flex-col items-center justify-center gap-1 bg-dream-surface px-2 text-center text-dream-muted">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7" aria-hidden>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                          <span className="line-clamp-2 text-[11px] font-medium text-dream-ink">{s.file.name}</span>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setPreview(s)} className="block h-32 w-full" title="Click to view fullscreen">
                          <Image
                            src={s.url}
                            alt={`Proof ${i + 1}`}
                            width={400}
                            height={400}
                            unoptimized
                            className="h-full w-full object-contain"
                          />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${s.file.name}`}
                        onClick={() => removeAt(i)}
                        className="absolute right-1.5 top-1.5 rounded-full bg-dream-ink/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden>
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-dream-line-strong text-dream-muted transition-colors hover:border-dream-purple hover:bg-dream-bg hover:text-dream-purple"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-6 w-6" aria-hidden>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="text-xs font-medium">Add more</span>
                  </button>
                </div>

                <p className="rounded-lg border border-dream-warn/30 bg-dream-warn-soft px-3 py-2 text-xs text-dream-warn">
                  The customer gets one email to approve {selected.length === 1 ? "this image" : `all ${selected.length} images`}. Double-check they&apos;re the right artwork and order.
                </p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              hidden
              onChange={(e) => {
                choose(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={uploading} disabled={selected.length === 0} onClick={send}>
              {selected.length > 1 ? `Send ${selected.length} to customer` : "Send to customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {preview && (
        <ProofLightbox
          src={preview.url}
          kind={preview.kind}
          title={preview.file.name}
          open={!!preview}
          onOpenChange={(o) => !o && setPreview(null)}
        />
      )}
    </>
  );
}
