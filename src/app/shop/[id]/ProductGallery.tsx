"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { Collapsible } from "@/components/storefront/Collapsible";
import { DetailedQuote } from "@/components/storefront/DetailedQuote";
import { SizeGuideModal } from "@/components/storefront/SizeGuideModal";
import { swatchStyle, sortColours } from "@/lib/swatch";
import type { ProductColourJson, ProductSizeJson, ProductQuoteCurveJson, QuoteDecoration } from "@/lib/db/rows";

/** Swatches shown before "Show all colours" is tapped (~2 rows on a phone). */
const COLLAPSED_COLOURS = 16;

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
  ssStyleId,
  brand,
  sku,
  name,
  colours: coloursProp,
  sizes,
  extraPhotos,
  startingPrice,
  quoteCurve,
  allowedDecorations,
  decorationNames,
  description,
  leadTimeDays,
}: {
  productId: string;
  /** S&S styleID, for the live size-guide lookup. Null for non-S&S products. */
  ssStyleId: string | null;
  brand: string | null;
  sku: string | null;
  name: string;
  colours: ProductColourJson[];
  sizes: ProductSizeJson[];
  /** Generic product photos (non-colour-specific) to append to the gallery. */
  extraPhotos: string[];
  startingPrice: number;
  /** Per-product quote curve (pricing_rules.quote); null falls back to the static card. */
  quoteCurve: ProductQuoteCurveJson | null;
  /** Curve decorations the admin enabled for this product (filters the quote picker). */
  allowedDecorations?: QuoteDecoration[];
  /** Names of the decoration methods this product offers, for the buy-box chips. */
  decorationNames?: string[];
  description: string | null;
  leadTimeDays: number;
}) {
  // Show the most-popular colours first (staples + primaries, then light -> dark).
  const colours = useMemo(() => sortColours(coloursProp), [coloursProp]);

  // Build the gallery: each enabled colour's front (and back/side/model) shots,
  // then any generic photos. The first colour with a front image leads.
  const images = useMemo<GalleryImage[]>(() => {
    const out: GalleryImage[] = [];
    colours.forEach((c, idx) => {
      const views: (keyof ProductColourJson["images"])[] = ["front", "back", "side", "model"];
      for (const v of views) {
        const src = c.images?.[v];
        // Some colourways repeat the same file across views; one tile each.
        if (src && !out.some((g) => g.src === src)) {
          out.push({ src, colourIdx: idx, label: `${c.name} ${v}` });
        }
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
  const firstInStockSize = sizes.findIndex((s) => s.inStock !== false);
  const [selectedSize, setSelectedSize] = useState(
    firstInStockSize >= 0 ? firstInStockSize : 0,
  );
  // Colour swatches collapse to two rows by default: a B+C 3001 carries 79 of
  // them, which pushed the size picker and the price a full screen down on a
  // phone. The selected swatch is always rendered, even when it lives past the
  // cut, so the ring never disappears on collapse.
  const [showAllColours, setShowAllColours] = useState(false);
  const colourList = useMemo(() => {
    const all = colours.map((c, idx) => ({ c, idx }));
    if (showAllColours || all.length <= COLLAPSED_COLOURS + 4) return all;
    const head = all.slice(0, COLLAPSED_COLOURS);
    if (selectedColour >= COLLAPSED_COLOURS && colours[selectedColour]) {
      head.push({ c: colours[selectedColour], idx: selectedColour });
    }
    return head;
  }, [colours, showAllColours, selectedColour]);

  // Cursor position (as %) for the hover-to-magnify effect on the main image.
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  // Whether the full-size lightbox popup is open.
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Close the lightbox on Escape, and lock body scroll while it's open.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen]);

  function pickColour(idx: number) {
    setSelectedColour(idx);
    const front = images.findIndex((g) => g.colourIdx === idx);
    if (front >= 0) setActiveImage(front);
  }

  const main = images[activeImage] ?? null;
  // Thumbnails show the SELECTED colour's shots plus any generic photos, which
  // is what the rail was always meant to be. Rendering every colour x view put
  // hundreds of tiles (and hundreds of image requests) in a strip nobody
  // scrolls to the end of; the swatches above are how you change colour.
  // Entries keep their index into `images` so activeImage still addresses it.
  const thumbs = useMemo(() => {
    const rows = images.map((g, idx) => ({ g, idx }));
    const own = rows.filter(({ g }) => g.colourIdx === selectedColour);
    // Product-level photos are only a fallback. For S&S styles that array holds
    // the style shot (often a different colourway entirely), so showing it
    // beside the selected colour's own photos put a black bag next to a white
    // one with nothing to explain why.
    return own.length > 0 ? own : rows.filter(({ g }) => g.colourIdx === null);
  }, [images, selectedColour]);

  return (
    <div className="grid gap-8 md:grid-cols-2 md:items-start">
      {/* Left: gallery.
          min-w-0 is load-bearing, not decoration: the thumbnail rail below is a
          horizontal scroll container holding one thumb per colour-view (79
          colours on a B+C 3001 = hundreds of them). Without it that content
          width propagates up through this grid item and sizes the grid TRACK to
          thousands of px, which the aspect-square main image then matches in
          height. That was the "image is enormous / page runs off screen" bug. */}
      <div className="flex min-w-0 flex-col-reverse gap-4 sm:flex-row">
        {thumbs.length > 1 && (
          <div className="flex w-full min-w-0 max-w-full shrink-0 gap-2 overflow-x-auto p-1 sm:w-auto sm:max-h-[28rem] sm:flex-col sm:overflow-y-auto">
            {thumbs.map(({ g, idx }) => (
              <button
                key={`${g.src}-${idx}`}
                type="button"
                onClick={() => {
                  setActiveImage(idx);
                  if (g.colourIdx !== null) setSelectedColour(g.colourIdx);
                }}
                aria-label={`View ${g.label}`}
                aria-current={idx === activeImage}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white transition-colors",
                  idx === activeImage
                    ? "border-dream-purple ring-1 ring-dream-purple/30"
                    : "border-dream-line hover:border-dream-line-strong",
                )}
              >
                <Image src={g.src} alt="" fill sizes="64px" className="object-contain p-1.5" />
              </button>
            ))}
          </div>
        )}

        <div
          className="group relative mx-auto aspect-square w-full min-w-0 cursor-zoom-in overflow-hidden rounded-xl border border-dream-line bg-white sm:max-w-[26rem] md:max-w-none"
          onClick={main ? () => setLightboxOpen(true) : undefined}
          role={main ? "button" : undefined}
          tabIndex={main ? 0 : undefined}
          aria-label={main ? "View full-size image" : undefined}
          onKeyDown={
            main
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLightboxOpen(true);
                  }
                }
              : undefined
          }
          onMouseMove={
            main
              ? (e) => {
                  // Touch devices fire a synthetic mousemove on tap but no
                  // mouseleave, which left the image stuck at scale(2). Only
                  // magnify for a real hovering pointer.
                  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  setHoverPos({
                    x: ((e.clientX - r.left) / r.width) * 100,
                    y: ((e.clientY - r.top) / r.height) * 100,
                  });
                }
              : undefined
          }
          onMouseLeave={() => setHoverPos(null)}
        >
          {main ? (
            <>
              <Image
                src={main.src}
                alt={`${name}, ${main.label}`}
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="cursor-zoom-in object-contain p-3 transition-transform duration-150 ease-out sm:p-6"
                style={{
                  transform: hoverPos ? "scale(2)" : "scale(1)",
                  transformOrigin: hoverPos ? `${hoverPos.x}% ${hoverPos.y}%` : "center",
                }}
                priority
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-dream-lavender-soft">
              <span className="text-sm text-dream-lavender-deep">No image</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: details */}
      <div className="flex min-w-0 flex-col gap-7">
        {/* 1, Identity: brand/sku, then the product name as the clear primary */}
        <div>
          {(brand || sku) && (
            <p className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-wide text-dream-muted lg:text-[14px]">
              {brand && <span>{brand}</span>}
              {brand && sku && (
                <span aria-hidden="true" className="text-dream-faint">/</span>
              )}
              {sku && <span className="font-medium normal-case tracking-normal text-dream-faint">SKU {sku}</span>}
            </p>
          )}
          <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight text-dream-ink sm:text-4xl">
            {name}
          </h1>
        </div>

        {/* 2, Options: colour + size, grouped tightly with matching labels */}
        <div className="-mt-3 flex flex-col gap-7 border-t border-dream-line pt-7">
        {colours.length > 0 && (
          <div>
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="text-[14px] font-semibold uppercase tracking-wide text-dream-ink">Colour</span>
                <span className="truncate text-sm text-dream-muted">{colours[selectedColour]?.name}</span>
              </div>
              {colours.length > COLLAPSED_COLOURS + 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllColours((o) => !o)}
                  aria-expanded={showAllColours}
                  className="-my-2 shrink-0 py-2 text-[12px] font-medium text-dream-ink-soft underline decoration-dream-ink-soft/70 decoration-1 underline-offset-4 transition-colors hover:text-dream-ink hover:decoration-dream-ink"
                >
                  {showAllColours ? "Show fewer" : `Show all ${colours.length} colours`}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {colourList.map(({ c, idx }) => (
                <button
                  key={`${c.name}-${idx}`}
                  type="button"
                  onClick={() => pickColour(idx)}
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={idx === selectedColour}
                  className={cn(
                    "relative h-8 w-8 rounded-full border border-dream-line transition-transform",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
                    c.inStock
                      ? "hover:scale-105"
                      : "cursor-not-allowed opacity-50",
                    idx === selectedColour &&
                      "ring-2 ring-offset-2 ring-offset-dream-surface",
                    idx === selectedColour &&
                      (c.inStock ? "ring-dream-purple" : "ring-dream-muted"),
                  )}
                  style={swatchStyle(c)}
                >
                  {!c.inStock && (
                    <span className="absolute inset-0 rounded-full bg-dream-ink/50" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {sizes.length > 0 && (
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[14px] font-semibold uppercase tracking-wide text-dream-ink">Size</span>
                <span className="text-sm text-dream-muted">{sizes[selectedSize]?.name}</span>
              </div>
              <SizeGuideModal ssStyleId={ssStyleId} productName={name} />
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s, idx) => {
                const oos = s.inStock === false;
                return (
                  <button
                    key={`${s.name}-${idx}`}
                    type="button"
                    disabled={oos}
                    onClick={() => setSelectedSize(idx)}
                    aria-pressed={idx === selectedSize}
                    className={cn(
                      "inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-colors",
                      oos
                        ? "cursor-not-allowed border-dream-line bg-dream-bg text-dream-faint line-through"
                        : idx === selectedSize
                          ? "border-dream-ink bg-dream-ink text-white"
                          : "border-dream-line bg-white text-dream-ink-soft hover:border-dream-ink/40 hover:text-dream-ink",
                    )}
                  >
                    {sizeLabel(s.name)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Decoration techniques this product offers (admin-toggled per product).
            Informational only, the customer picks a method later in the
            designer, so these are styled as passive "available" tags, not the
            selectable pills used for colour/size above. */}
        {decorationNames && decorationNames.length > 0 && (
          <div className="pb-2">
            <span className="text-[14px] font-semibold uppercase tracking-wide text-dream-ink">
              Decoration
            </span>
            {/* Little tilted icon badges, the same device the value props at the
                foot of this page use, shrunk down. It carries the site's
                hand-made character without a pill or an outline, so nothing
                here reads as a choice to tap. */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-3">
              {decorationNames.map((n, i) => (
                <span key={n} className="inline-flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      i % 2 === 0
                        ? "-rotate-3 bg-dream-lavender-soft text-dream-purple-dark"
                        : "rotate-3 bg-dream-sun-soft text-dream-ink",
                    )}
                  >
                    <DecorationIcon name={n} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-sm font-semibold text-dream-ink">{n}</span>
                </span>
              ))}
            </div>
            <p className="mt-2 text-[14px] text-dream-muted">
              Available on this product. You&apos;ll choose a method when you customize.
            </p>
          </div>
        )}
        </div>

        {/* Interactive detailed quote (or the static estimate card as a fallback) */}
        {quoteCurve ? (
          <DetailedQuote
            curve={quoteCurve}
            productId={productId}
            colourName={colours[selectedColour]?.name}
            allowedDecorations={allowedDecorations}
          />
        ) : (
          <div className="-mt-3 flex flex-col gap-4 rounded-lg border border-dream-line bg-dream-surface p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[14px] font-semibold uppercase tracking-wide text-dream-muted">
                Estimated total
              </p>
              <p className="font-display text-3xl font-extrabold text-dream-purple-dark">
                from {formatCAD(startingPrice)}
                <span className="ml-1 text-base font-normal text-dream-muted">/unit</span>
              </p>
              <p className="mt-1 text-[14px] text-dream-muted">
                Final pricing depends on quantity &amp; decoration.
              </p>
            </div>
            <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:items-center">
              <Link
                href={`/design/${productId}?colour=${encodeURIComponent(colours[selectedColour]?.name ?? "")}`}
                className="rough-pill rough-pill-filled inline-flex w-full items-center justify-center px-7 py-3 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5 sm:w-auto"
              >
                Design Now
              </Link>
              <Link
                href={`/design/${productId}?quote=1&colour=${encodeURIComponent(colours[selectedColour]?.name ?? "")}`}
                className="text-center text-sm font-semibold text-dream-purple hover:underline"
              >
                Quick Quote
              </Link>
            </div>
          </div>
        )}

        {/* Collapsible info sections, under the estimated total box */}
        <div>
          <Collapsible title="Product details">
            {(() => {
              const items = description ? parseDescription(description) : [];
              if (items.length > 1) {
                return (
                  <ul className="flex list-none flex-col gap-1.5 pl-0">
                    {items.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dream-purple/60" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                );
              }
              if (items.length === 1) return <p>{items[0]}</p>;
              return (
                <p>
                  A custom-ready blank, decorated in-house. Choose your colour and
                  sizes, then add artwork in the designer. Screenprint,
                  embroidery, or DTF depending on the piece.
                </p>
              );
            })()}
          </Collapsible>
          <Collapsible title="Shipping & turnaround">
            <p>
              Ships in ~{leadTimeDays} business day
              {leadTimeDays === 1 ? "" : "s"} once your proof is approved. Local
              Vancouver pickup is available. Choose it at checkout to skip
              shipping.
            </p>
          </Collapsible>
        </div>
      </div>

      {/* Full-size image lightbox */}
      {lightboxOpen && main && (
        <div
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-dream-overlay/90 backdrop-blur-sm p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${name}, full size`}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-dream-ink shadow-md transition-colors hover:bg-white"
          >
            <span aria-hidden="true" className="text-2xl leading-none">&times;</span>
          </button>
          {/* Click anywhere (image included) closes, no dead-zones, instant. */}
          <div className="pointer-events-none relative h-full max-h-[85vh] w-full max-w-4xl">
            <Image
              src={main.src}
              alt={`${name}, ${main.label}`}
              fill
              sizes="90vw"
              className="object-contain"
              priority
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Common print-colour names -> hex, for splitting two-tone swatches like "Natural/Black". */
/** Decode the handful of HTML entities that show up in S&S descriptions. */
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/**
 * S&S descriptions arrive as one run-on string with "•" bullet separators and
 * raw HTML entities. Split into clean bullet items so the panel reads as a list.
 */
function parseDescription(raw: string): string[] {
  return decodeEntities(raw)
    .split(/\s*[•·]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A doodle per decoration method: a squeegee pulling ink for printing, a needle
 * and thread for embroidery, a heat press for transfers. Falls back to a plain
 * garment mark for anything Julian adds later.
 */
function DecorationIcon({ name, className }: { name: string; className?: string }) {
  const n = name.toLowerCase();
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (n.includes("embroid")) {
    // Needle on the diagonal, eye at the top, thread looping through it.
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
        <path d="M4.8 19.2 16.6 7.4" />
        <ellipse cx="18.1" cy="5.9" rx="1.7" ry="1.1" transform="rotate(-45 18.1 5.9)" />
        <path d="M20.3 7.7c.9 1.9 0 3.6-1.8 4.1-1.5.4-2.5-.5-2.1-1.7" />
      </svg>
    );
  }
  if (n.includes("dtf") || n.includes("transfer") || n.includes("vinyl")) {
    // Transfer sheet lifting off a garment, with heat rising.
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
        <path d="M4 20h16" />
        <rect x="6" y="10.5" width="12" height="7" rx="1.5" />
        <path d="M9 7.5c.8-.8.8-1.7 0-2.5M12 7.5c.8-.8.8-1.7 0-2.5M15 7.5c.8-.8.8-1.7 0-2.5" />
      </svg>
    );
  }
  // Squeegee: a handle bar above a wide blade, with the ink it just pulled
  // showing as a stroke underneath. Reads at 18px because it is three
  // horizontal bands rather than a frame with detail inside it.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <path d="M9.5 4h5v3h-5z" />
      <path d="M12 7v2" />
      <path d="M4 9.5h16l-2 5H6l-2-5Z" />
      <path d="M5.5 19.5c4.4-1.5 8.6-1.5 13 0" />
    </svg>
  );
}

/** Abbreviate verbose size names for the compact pills (e.g. "One Size" -> "OS"). */
function sizeLabel(name: string | undefined): string {
  if (!name) return "";
  if (/^one\s*size$/i.test(name.trim())) return "OS";
  return name;
}
