"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { ProofLightbox, fileKind } from "./ProofLightbox";
import { useProofUpload } from "./shared";

interface Selected {
  file: File;
  url: string;
  kind: "image" | "pdf";
}

/**
 * Proof upload dialog. Uploading only FILES the proof on the order (no email,
 * no status change); the whole order goes to the customer at once via the
 * explicit "Send for approval" action once everything is checked and finalized.
 * Preview is the exact local file, so it's WYSIWYG.
 */
export function ProofReviewDialog({
  orderId,
  lineItemId,
  lines,
  open,
  onOpenChange,
  orderNumber,
  customerName,
  contextLabel,
  isReplacement,
}: {
  orderId: string;
  lineItemId?: string;
  /**
   * The order's line items, for the order-level upload button. With more than
   * one line the proof has to say which garment it is for (every line needs its
   * own proof before the order can be sent), so the dialog asks. Ignored when
   * `lineItemId` already pins the upload to a line.
   */
  lines?: { id: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string | null;
  customerName: string;
  /** e.g. the line item's product name, so multi-item orders are unambiguous. */
  contextLabel?: string;
  /** changes_requested / re-proof, tweaks the copy. */
  isReplacement?: boolean;
}) {
  const { uploading, uploadProofs } = useProofUpload(orderId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Selected | null>(null);
  const [pickedLine, setPickedLine] = useState("");

  // One line (or an upload already pinned to one) needs no question asked.
  const needsLinePick = !lineItemId && (lines?.length ?? 0) > 1;
  const targetLine = lineItemId ?? (needsLinePick ? pickedLine : lines?.[0]?.id) ?? undefined;

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
    setPickedLine("");
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function send() {
    if (selected.length === 0) return;
    if (needsLinePick && !pickedLine) return;
    const r = await uploadProofs(selected.map((s) => s.file), targetLine);
    if (r.ok) close(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isReplacement ? "Add a new proof" : "Add proof to order"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-5">
            {/* Who it's going to, confirm the right order before sending. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-dream-bg px-3 py-2 text-sm">
              <span className="text-dream-muted">For</span>
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

            {/* Which garment is this proof for? Asked only on multi-line orders,
                where the answer decides whether the order is cleared to send. */}
            {needsLinePick && (
              <div>
                <label htmlFor="proof-line" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-dream-muted">
                  Which item is this proof for?
                </label>
                <Select id="proof-line" value={pickedLine} onChange={(e) => setPickedLine(e.target.value)}>
                  <option value="">Pick an item…</option>
                  {(lines ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-dream-muted">
                  Each item needs its own proof before the order can go out for approval.
                </p>
              </div>
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
                {/* "Drop, or click" describes nothing a phone can do. */}
                <span className="font-medium text-dream-ink sm:hidden">Tap to add proofs</span>
                <span className="hidden font-medium text-dream-ink sm:inline">Drop proofs here, or click to browse</span>
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
                        // The only way to deselect a file, so it cannot be
                        // hover-only: visible on touch, hover-revealed from md.
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-dream-ink/70 text-white opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
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

                <p className="rounded-lg bg-dream-bg px-3 py-2 text-xs text-dream-muted">
                  Nothing is emailed yet. Proofs pile up on the order, and the customer sees the whole set at once when you
                  send the order for approval.
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
            <Button variant="primary" loading={uploading} disabled={selected.length === 0 || (needsLinePick && !pickedLine)} onClick={send}>
              {selected.length > 1 ? `Save ${selected.length} to order` : "Save to order"}
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
