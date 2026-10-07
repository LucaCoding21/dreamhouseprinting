"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { pdfThumbUrl } from "@/lib/pdf/preview";

/**
 * The plain document tile every PDF used to be. It is now only the loading and
 * failure state of PdfThumb, so a PDF that can't be fetched or parsed looks
 * exactly like it did before, never like a broken image.
 */
export function PdfGlyph({
  className,
  iconClassName = "h-8 w-8",
  label = "PDF",
  labelClassName = "text-[12px] font-semibold",
}: {
  className?: string;
  iconClassName?: string;
  label?: string | null;
  labelClassName?: string;
}) {
  return (
    <span className={cn("flex h-full w-full flex-col items-center justify-center gap-1 text-dream-muted", className)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={iconClassName} aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      {label && <span className={labelClassName}>{label}</span>}
    </span>
  );
}

/**
 * Page 1 of a PDF as a real thumbnail. Renders nothing heavy until the tile
 * scrolls near the viewport, sizes the render to the tile (times the screen's
 * pixel ratio, capped), and shares one render per PDF across the whole page.
 * Shows `fallback` (the document glyph by default) while loading and on error.
 *
 * The root is a plain block span, deliberately unpositioned, so a caller's
 * absolutely positioned badges and dots keep painting on top of it.
 */
export function PdfThumb({
  src,
  alt,
  className,
  imgClassName,
  fallback,
}: {
  src: string;
  alt: string;
  /** Root box. Defaults to filling the parent (block h-full w-full). */
  className?: string;
  /** Extra classes for the rendered page image (object-contain on white by default). */
  imgClassName?: string;
  fallback?: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Keyed by src so a swapped src never flashes the previous PDF's page.
  const [rendered, setRendered] = useState<{ src: string; url: string } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const start = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = (el.getBoundingClientRect().width || 160) * dpr;
      pdfThumbUrl(src, width).then(
        (url) => {
          if (!cancelled) setRendered({ src, url });
        },
        () => {
          // Fallback glyph stays up.
        },
      );
    };
    if (typeof IntersectionObserver === "undefined") {
      start();
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [src]);

  const url = rendered?.src === src ? rendered.url : null;

  return (
    <span ref={ref} className={cn("block h-full w-full", className)}>
      {url ? (
        // Plain img: an object URL of our own render, nothing to optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className={cn("h-full w-full bg-white object-contain", imgClassName)} />
      ) : (
        (fallback ?? <PdfGlyph />)
      )}
    </span>
  );
}
