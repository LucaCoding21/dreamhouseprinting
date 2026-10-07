"use client";

import { useEffect } from "react";
import Image from "next/image";
import { IconClose } from "@/components/portal/icons";
import { PdfPages } from "./PdfPages";

/**
 * Full-size viewer for a proof or mockup, shared by the per-line visual and
 * the proof-approval panel so the two can't drift apart. Dark scrim, the file
 * centred, a caption bar underneath saying what it is, and an "Open" link so
 * the customer can save or print the original (the in-page image is a sized
 * render, the link is the real file). Optional prev/next for a set.
 *
 * Signed Storage URLs keep the original filename before the ?token, so the
 * extension is a reliable PDF signal.
 */
export function isPdf(src: string): boolean {
  return /\.pdf(\?|#|$)/i.test(src);
}

export function Lightbox({
  src,
  title,
  tag,
  onClose,
  onPrev,
  onNext,
  counter,
}: {
  src: string;
  /** What the customer is looking at, e.g. "Jersey Tee, Black". */
  title: string;
  /** Short qualifier shown beside the title: "Approved proof", "Proof", "Mockup". */
  tag?: string | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** "2 / 3" when browsing a set. */
  counter?: string | null;
}) {
  const pdf = isPdf(src);

  // Esc closes, Left/Right step through a set when the callbacks exist.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev?.();
      else if (e.key === "ArrowRight") onNext?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  // Keep the page from scrolling behind the viewer.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const navBtn =
    "absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dream-overlay/90 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${title}, full size`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
        aria-label="Close"
      >
        <IconClose className="h-5 w-5" />
      </button>

      {onPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className={`${navBtn} left-3 sm:left-6`}
          aria-label="Previous"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className={`${navBtn} right-3 sm:right-6`}
          aria-label="Next"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div
        className="flex max-h-full w-fit max-w-full flex-col items-stretch gap-3 sm:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {pdf ? (
          // Rendered pages, not an <iframe>: Chrome on Android shows a blank
          // frame for PDFs and iOS a static first page. The iframe stays only
          // as the fallback for a file pdf.js can't parse.
          <div className="flex max-h-[78dvh] w-[85vw] max-w-4xl flex-col overflow-y-auto overscroll-contain rounded-lg">
            <PdfPages
              key={src}
              src={src}
              title={title}
              // Each page fits the screen whatever its shape: a tall
              // portrait proof is seen whole (no scrolling to find its
              // bottom), a wide one fits the width. Extra pages scroll.
              pageClassName="mx-auto max-h-[78dvh] w-auto max-w-full shadow-2xl"
              fallback={
                <iframe src={src} title={`${title}, full size`} className="h-[78dvh] w-full shrink-0 rounded-lg bg-white shadow-2xl" />
              }
            />
          </div>
        ) : (
          <Image
            src={src}
            alt={`${title}, full size`}
            width={1400}
            height={1400}
            className="max-h-[78dvh] w-auto max-w-full self-center rounded-lg bg-white object-contain shadow-2xl"
          />
        )}

        {/* Caption: what it is on the left, the real file on the right. */}
        <div className="flex items-center justify-between gap-3 px-1 py-1 text-white">
          {/* truncate on the block, not the inline span (which never clipped,
              so the title ran under the button on phones). */}
          <div className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold">{title}</span>
            {tag && <span className="ml-2 text-white/70">{tag}</span>}
            {counter && <span className="ml-2 tabular-nums text-white/70">{counter}</span>}
          </div>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[13px] font-semibold text-white/85 transition-colors hover:text-white"
          >
            Open {pdf ? "PDF" : "image"}
          </a>
        </div>
      </div>
    </div>
  );
}
