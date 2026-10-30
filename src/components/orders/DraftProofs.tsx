"use client";

import { IconZoom } from "@/components/portal/icons";
import { isPdf } from "./Lightbox";
import { PdfGlyph, PdfThumb } from "./PdfThumb";
import type { OrderViewProof } from "./types";

/**
 * Proofs Julian has uploaded while the order is still at "Order received",
 * before he sends them for approval. A folded section under the items, closed
 * by default: they are a peek at work in progress, so they ask nothing of the
 * customer (no buttons, no status) and stay out of the way until opened. Any
 * number of proofs wraps onto more rows; each opens in a new tab.
 */
export function DraftProofs({ proofs }: { proofs: OrderViewProof[] }) {
  const multiple = proofs.length > 1;

  return (
    <details className="group mt-5 border-t border-dream-line pt-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-dream-muted transition-colors group-hover:text-dream-ink">
          {multiple ? `Draft proofs (${proofs.length})` : "Draft proof"}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0 text-dream-purple transition-transform group-open:rotate-180"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>

      <div className="mt-3 flex flex-wrap gap-3">
        {proofs.map((p, i) => (
          <a
            key={p.id}
            href={p.image}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open draft proof ${i + 1} in a new tab`}
            title="Open in a new tab"
            className="group/tile relative block h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-dream-ink/10 bg-white transition-[border-color,box-shadow] hover:border-dream-purple hover:shadow-[0_4px_0_0_rgba(118,100,255,0.35)] focus-visible:border-dream-purple focus-visible:outline-none sm:h-28 sm:w-28"
          >
            {isPdf(p.image) ? (
              <PdfThumb
                src={p.image}
                alt={`Draft proof ${i + 1}`}
                imgClassName="transition-transform duration-200 group-hover/tile:scale-[1.06]"
                fallback={<PdfGlyph className="transition-colors group-hover/tile:text-dream-purple" />}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={p.image}
                alt={`Draft proof ${i + 1}`}
                className="h-full w-full object-contain transition-transform duration-200 group-hover/tile:scale-[1.06]"
              />
            )}
            {/* Same hover as the item / design tiles (LineVisual): purple edge,
                slight zoom, and the zoom badge lights up. */}
            <span
              aria-hidden
              className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-dream-ink shadow-sm ring-1 ring-dream-ink/10 transition-colors group-hover/tile:bg-dream-purple group-hover/tile:text-white group-hover/tile:ring-dream-purple"
            >
              <IconZoom className="h-4 w-4" />
            </span>
          </a>
        ))}
      </div>
    </details>
  );
}
