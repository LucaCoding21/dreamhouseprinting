"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { IconZoom, IconCheck } from "@/components/portal/icons";
import { Lightbox, isPdf } from "./Lightbox";

/**
 * The picture that belongs to one line of an order: its approved proof when
 * there is one, otherwise the design mockup, otherwise a plain colour swatch.
 *
 * The whole tile is one button. Earlier versions put a "View full size"
 * caption under an 80px thumb, outside the button: hovering the words did
 * nothing, the caption wrapped to two lines, and the picture was too small to
 * be worth clicking. Now the tile is bigger, the status ("Approved" / "Proof")
 * sits on the picture as a pill, and a zoom badge in the corner says it opens,
 * which also reads on touch where there is no hover.
 *
 * The proof wins over the mockup deliberately: the proof is the artwork Julian
 * actually prints, the mockup is what the designer produced. Once a proof is
 * approved this is where it lives (the proof panel above disappears), so it has
 * to be reachable from the item it belongs to.
 */
export function LineVisual({
  mockup,
  proof,
  colourName,
  colourHex,
  alt,
  className,
}: {
  mockup: string | null;
  proof: { id: string; image: string; status: string } | null;
  colourName: string | null;
  colourHex: string | null;
  /** Describes the garment, e.g. "Jersey Tee, Black". */
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const src = proof?.image ?? mockup ?? null;
  const pdf = !!src && isPdf(src);
  const approved = proof?.status === "approved";
  const kind = proof ? (approved ? "Approved proof" : "Proof") : "Mockup";

  const tile = "h-24 w-24 shrink-0 rounded-2xl border-2 border-dream-ink/10 sm:h-28 sm:w-28";

  // Nothing to show: the colour swatch placeholder, not clickable.
  if (!src) {
    return (
      <div
        className={cn(tile, "flex flex-col items-center justify-center overflow-hidden p-1 text-center", className)}
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${kind.toLowerCase()} full size: ${alt}`}
        title="View full size"
        className={cn(
          tile,
          "group relative block overflow-hidden bg-white transition-[border-color,box-shadow] hover:border-dream-purple hover:shadow-[0_4px_0_0_rgba(118,100,255,0.35)] focus-visible:border-dream-purple focus-visible:outline-none",
          className,
        )}
      >
        {pdf ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-dream-muted transition-colors group-hover:text-dream-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <span className="text-[12px] font-semibold">PDF</span>
          </span>
        ) : (
          <Image
            src={src}
            alt={alt}
            width={224}
            height={224}
            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.06]"
          />
        )}

        {/* Status on the picture, so the tile needs no caption below it. */}
        {proof && (
          <span
            className={cn(
              "absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none shadow-sm",
              approved ? "bg-dream-success text-white" : "bg-dream-purple text-white",
            )}
          >
            {approved && <IconCheck className="h-2.5 w-2.5" />}
            {approved ? "Approved" : "Proof"}
          </span>
        )}

        {/* Zoom badge: always visible (touch has no hover), lights up on hover. */}
        <span
          aria-hidden
          className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-dream-ink shadow-sm ring-1 ring-dream-ink/10 transition-colors group-hover:bg-dream-purple group-hover:text-white group-hover:ring-dream-purple"
        >
          <IconZoom className="h-4 w-4" />
        </span>
      </button>

      {open && <Lightbox src={src} title={alt} tag={kind} onClose={() => setOpen(false)} />}
    </>
  );
}
