"use client";

import { useEffect } from "react";
import Image from "next/image";
import { IconClose } from "@/components/portal/icons";

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
          <iframe
            src={src}
            title={`${title}, full size`}
            className="h-[78vh] w-[85vw] max-w-4xl rounded-lg bg-white shadow-2xl"
          />
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
        <div className="flex items-center justify-between gap-3 rounded-full bg-white/10 px-4 py-2 text-white">
          <div className="min-w-0 text-sm">
            <span className="truncate font-semibold">{title}</span>
            {tag && <span className="ml-2 text-white/70">{tag}</span>}
            {counter && <span className="ml-2 tabular-nums text-white/70">{counter}</span>}
          </div>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold transition-colors hover:bg-white/30"
          >
            Open {pdf ? "PDF" : "image"}
          </a>
        </div>
      </div>
    </div>
  );
}
