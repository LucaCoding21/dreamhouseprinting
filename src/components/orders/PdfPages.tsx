"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { openPdf, renderPdfPage, type RenderedPage } from "@/lib/pdf/preview";

const MAX_PAGES = 12;

interface PagesState {
  src: string;
  pages: RenderedPage[];
  /** Page count of the whole document, once known. */
  total: number;
  failed: boolean;
}

/**
 * Every page of a PDF (up to 12) rendered by pdf.js and stacked top to bottom.
 * Replaces the <iframe> viewers: Chrome on Android shows nothing in a PDF
 * iframe and iOS shows a static first page, so a customer on a phone could not
 * actually read their proof. Pages appear one by one as they render. If pdf.js
 * can't handle the file, `fallback` (usually the old iframe) is returned bare,
 * so the caller's layout around it still applies.
 */
export function PdfPages({
  src,
  title,
  className,
  pageClassName,
  minRenderWidth = 0,
  noteClassName = "text-white/80",
  placeholderClassName,
  fallback = null,
}: {
  src: string;
  /** Names the pages for screen readers: "{title}, page 2". */
  title: string;
  className?: string;
  /** Classes for each page image. */
  pageClassName?: string;
  /** Floor on the render width in pixels (the artwork sheet asks for print resolution). */
  minRenderWidth?: number;
  /** The "first 12 of N pages" note. Defaults to light text for the dark viewers. */
  noteClassName?: string;
  /** Extra classes for the page-shaped box shown while rendering. */
  placeholderClassName?: string;
  fallback?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PagesState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = Math.min(ref.current?.clientWidth || 800, 1400);
    const width = Math.max(box * dpr, minRenderWidth);

    (async () => {
      let doc: Awaited<ReturnType<typeof openPdf>> | null = null;
      try {
        doc = await openPdf(src);
        const total = doc.numPages;
        for (let n = 1; n <= Math.min(total, MAX_PAGES); n++) {
          if (cancelled) return;
          const page = await renderPdfPage(doc, n, width);
          if (cancelled) {
            URL.revokeObjectURL(page.url);
            return;
          }
          urls.push(page.url);
          setState((prev) =>
            prev?.src === src
              ? { ...prev, total, pages: [...prev.pages, page] }
              : { src, total, pages: [page], failed: false },
          );
        }
      } catch {
        if (!cancelled) setState({ src, pages: [], total: 0, failed: true });
      } finally {
        void doc?.destroy();
      }
    })();

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [src, minRenderWidth]);

  const view = state?.src === src ? state : null;
  if (view?.failed) return <>{fallback}</>;

  const pages = view?.pages ?? [];
  const total = view?.total ?? 0;
  const more = Math.max(0, total - MAX_PAGES);

  return (
    <div ref={ref} className={cn("flex w-full flex-col gap-3", className)}>
      {pages.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.url}
          src={p.url}
          width={p.width}
          height={p.height}
          alt={total > 1 ? `${title}, page ${i + 1}` : title}
          className={cn("block h-auto w-full rounded-lg bg-white", pageClassName)}
        />
      ))}
      {/* Still rendering: a page-shaped placeholder so the viewer isn't empty. */}
      {(!view || pages.length < Math.min(total, MAX_PAGES)) && (
        <div className={cn("grid aspect-[4/3] w-full place-items-center rounded-lg bg-white text-sm font-medium text-dream-muted", placeholderClassName)}>
          {pages.length === 0 ? "Loading PDF..." : "Loading next page..."}
        </div>
      )}
      {more > 0 && (
        <p className={cn("text-center text-sm", noteClassName)}>
          Showing the first {MAX_PAGES} of {total} pages. Open the PDF to see the rest.
        </p>
      )}
    </div>
  );
}
