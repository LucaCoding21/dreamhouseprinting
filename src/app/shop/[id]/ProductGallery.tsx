"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import type { ProductColourJson, ProductSizeJson } from "@/lib/db/rows";

interface GalleryImage {
  src: string;
  /** Index into the colours array this image belongs to, or null for generic photos. */
  colourIdx: number | null;
  label: string;
}

/**
 * Interactive top section of the product detail page (matches productpage3.png):
 * a thumbnail gallery + large main image on the left, and on the right the brand,
 * title, colour swatches, size pills, and the ESTIMATED TOTAL card with the two
 * CTAs. Selecting a colour swatch (or a thumbnail) swaps the main image.
 */
export function ProductGallery({
  productId,
  brand,
  name,
  colours,
  sizes,
  extraPhotos,
  startingPrice,
}: {
  productId: string;
  brand: string | null;
  name: string;
  colours: ProductColourJson[];
  sizes: ProductSizeJson[];
  /** Generic product photos (non-colour-specific) to append to the gallery. */
  extraPhotos: string[];
  startingPrice: number;
}) {
  // Build the gallery: each enabled colour's front (and back/side/model) shots,
  // then any generic photos. The first colour with a front image leads.
  const images = useMemo<GalleryImage[]>(() => {
    const out: GalleryImage[] = [];
    colours.forEach((c, idx) => {
      const views: (keyof ProductColourJson["images"])[] = ["front", "back", "side", "model"];
      for (const v of views) {
        const src = c.images?.[v];
        if (src) out.push({ src, colourIdx: idx, label: `${c.name} ${v}` });
      }
    });
    for (const src of extraPhotos) {
      if (!out.some((g) => g.src === src)) out.push({ src, colourIdx: null, label: name });
    }
    return out;
  }, [colours, extraPhotos, name]);

  const firstColourWithImage = colours.findIndex((c) => c.images?.front);
  const [selectedColour, setSelectedColour] = useState(
    firstColourWithImage >= 0 ? firstColourWithImage : 0,
  );
  const [activeImage, setActiveImage] = useState(() => {
    const i = images.findIndex((g) => g.colourIdx === (firstColourWithImage >= 0 ? firstColourWithImage : 0));
    return i >= 0 ? i : 0;
  });

  function pickColour(idx: number) {
    setSelectedColour(idx);
    const front = images.findIndex((g) => g.colourIdx === idx);
    if (front >= 0) setActiveImage(front);
  }

  const main = images[activeImage] ?? null;
  // Thumbnails: prefer the front shot of each colour plus generic photos, capped.
  const thumbs = images;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: gallery */}
      <div className="flex flex-col-reverse gap-4 sm:flex-row">
        {thumbs.length > 1 && (
          <div className="flex shrink-0 gap-2 overflow-x-auto sm:max-h-[28rem] sm:flex-col sm:overflow-y-auto">
            {thumbs.map((g, i) => (
              <button
                key={`${g.src}-${i}`}
                type="button"
                onClick={() => {
                  setActiveImage(i);
                  if (g.colourIdx !== null) setSelectedColour(g.colourIdx);
                }}
                aria-label={`View ${g.label}`}
                aria-current={i === activeImage}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white transition-colors",
                  i === activeImage
                    ? "border-dream-purple ring-1 ring-dream-purple/30"
                    : "border-dream-line hover:border-dream-line-strong",
                )}
              >
                <Image src={g.src} alt="" fill sizes="64px" className="object-contain p-1.5" />
              </button>
            ))}
          </div>
        )}

        <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-dream-line bg-white shadow-[0_12px_44px_-18px_rgba(118,100,255,0.35)]">
          {main ? (
            <Image
              src={main.src}
              alt={`${name} — ${main.label}`}
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-contain p-6"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-dream-lavender-soft">
              <span className="text-sm text-dream-lavender-deep">No image</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: details */}
      <div className="flex flex-col gap-5">
        <div>
          {brand && (
            <p className="text-xs font-semibold uppercase tracking-wide text-dream-purple">
              {brand}
            </p>
          )}
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-dream-ink sm:text-3xl">
            {name}
          </h1>
        </div>

        {colours.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="font-medium text-dream-ink">Colour</span>
              <span className="text-dream-muted">{colours[selectedColour]?.name}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {colours.map((c, idx) => (
                <button
                  key={`${c.name}-${idx}`}
                  type="button"
                  onClick={() => pickColour(idx)}
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={idx === selectedColour}
                  className={cn(
                    "relative h-8 w-8 rounded-full border border-dream-line transition-transform",
                    "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
                    idx === selectedColour &&
                      "ring-2 ring-dream-purple ring-offset-2 ring-offset-dream-surface",
                  )}
                  style={{ backgroundColor: c.hex || "#ddd" }}
                >
                  {!c.inStock && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="h-px w-7 rotate-45 bg-dream-danger" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {sizes.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium text-dream-ink">Size</div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s, idx) => (
                <span
                  key={`${s.name}-${idx}`}
                  className={cn(
                    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-medium",
                    s.inStock === false
                      ? "border-dream-line bg-dream-bg text-dream-faint line-through"
                      : "border-dream-line bg-dream-surface text-dream-ink",
                  )}
                >
                  {s.name}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-dream-faint">
              Pick sizes and quantities in the designer.
            </p>
          </div>
        )}

        {/* Estimated total card */}
        <div className="rounded-2xl border border-dream-line bg-gradient-to-br from-white to-dream-lavender-soft/50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-dream-purple">
            Estimated total
          </p>
          <p className="font-display text-3xl font-extrabold text-dream-ink">
            from {formatCAD(startingPrice)}
            <span className="ml-1 text-sm font-normal text-dream-ink-soft">/ unit</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-dream-ink-soft">
            Final price depends on quantity, decoration, and ink colours. No
            surprises — you&apos;ll see live pricing in the designer.
          </p>
          <div className="mt-4 space-y-2">
            <Link
              href={`/design/${productId}`}
              className="rough-pill rough-pill-filled flex w-full items-center justify-center px-6 py-3.5 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Design now
            </Link>
            <Link
              href={`/design/${productId}?quote=1`}
              className="flex w-full items-center justify-center rounded-full border border-dream-line bg-white px-6 py-3 font-display text-sm font-bold text-dream-ink transition-colors hover:bg-dream-cream"
            >
              Customize quote
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
