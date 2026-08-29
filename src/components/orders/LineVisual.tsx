"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { IconZoom, IconClose } from "@/components/portal/icons";

/**
 * The picture that belongs to one line of an order: its approved proof when
 * there is one, otherwise the design mockup, otherwise a plain colour swatch.
 * Clicking opens it full size, which is the whole point, a customer checking
 * their artwork needs more than an 80px thumbnail.
 *
 * The proof wins over the mockup deliberately: the proof is the artwork Julian
 * actually prints, the mockup is what the designer produced. Once a proof is
 * approved this is where it lives (the proof panel above disappears), so it has
 * to be reachable from the item it belongs to.
 */

/** Signed Storage URLs keep the original filename before the ?token, so the
 *  extension is a reliable PDF signal. */
function isPdf(src: string): boolean {
  return /\.pdf(\?|#|$)/i.test(src);
}

export function LineVisual({
  mockup,
  proof,
  colourName,
  colourHex,
  alt,
  className,
  hideTag = false,
}: {
  mockup: string | null;
  proof: { id: string; image: string; status: string } | null;
  colourName: string | null;
  colourHex: string | null;
  /** Describes the garment, e.g. "Jersey Tee, Black". */
  alt: string;
  className?: string;
  /** Drop the caption under the thumb (the caller renders its own). */
  hideTag?: boolean;
}) {
  const [zoom, setZoom] = useState(false);

  const src = proof?.image ?? mockup ?? null;
  const pdf = !!src && isPdf(src);
  const approved = proof?.status === "approved";

  // Esc closes the lightbox, same as the proof panel's.
  useEffect(() => {
    if (!zoom) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoom(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  // Nothing to show: the colour swatch placeholder, not clickable.
  if (!src) {
    return (
      <div
        className={cn(
          "flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dream-ink/10 p-1 text-center",
          className,
        )}
        style={{ backgroundColor: colourHex ?? "var(--color-dream-cream)" }}
      >
        {colourName && (
          <span className="rounded bg-white/85 px-1 text-[14px] font-medium leading-tight text-dream-ink">
            {colourName}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-20 shrink-0", className)}>
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label={`View ${proof ? "proof" : "mockup"} full size: ${alt}`}
        className="group block h-20 w-20 overflow-hidden rounded-xl border border-dream-line bg-dream-bg p-1.5 transition-colors hover:border-dream-purple/40"
      >
        {pdf ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-dream-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <span className="text-[11px] font-semibold">PDF</span>
          </span>
        ) : (
          <Image src={src} alt={alt} width={160} height={160} className="h-full w-full object-contain" />
        )}
      </button>

      {/* What am I looking at, and that it opens. */}
      {!hideTag && (
      <span
        className={cn(
          "mt-1 flex items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
          proof
            ? approved
              ? "bg-dream-success-soft text-dream-success"
              : "bg-dream-lavender-soft text-dream-purple"
            : "text-dream-muted",
        )}
      >
        {!proof && <IconZoom className="h-3 w-3" />}
        {proof ? (approved ? "Approved proof" : "Proof") : "View full size"}
      </span>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dream-overlay/90 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setZoom(false)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-[3px] bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <IconClose className="h-5 w-5" />
          </button>
          <div className="relative max-h-full w-fit max-w-full sm:max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {pdf ? (
              <iframe
                src={src}
                title={`${alt}, full size`}
                className="h-[85vh] w-[85vw] max-w-4xl rounded-lg bg-white shadow-2xl"
              />
            ) : (
              <Image
                src={src}
                alt={`${alt}, full size`}
                width={1400}
                height={1400}
                className="max-h-[85dvh] w-auto max-w-full rounded-lg bg-white object-contain shadow-2xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
