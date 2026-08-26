"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { shopPriceAtQty } from "@/lib/pricing/quote";
import { useShopQty } from "@/components/storefront/ShopQuantity";
import { productPrimaryImage, colourCardImage, enabledColours } from "@/lib/productImage";
import { swatchStyle, sortColours, heroColour } from "@/lib/swatch";
import type { ProductRow } from "@/lib/db/rows";

/**
 * Catalog product card, image, brand, name, "from $X", colour dots. The card
 * links into the product page (overlay <Link>), while the colour dots are real
 * buttons that swap the displayed image to the selected colour without
 * navigating (so they sit above the overlay link, not nested inside it).
 */
export function ProductCard({
  product,
  className,
  featured = false,
}: {
  product: ProductRow;
  className?: string;
  featured?: boolean;
}) {
  const { qty } = useShopQty();
  const price = shopPriceAtQty(product, qty);

  const fallbackImage = productPrimaryImage(product);
  // Show the most-popular colours first (staples + primaries, then light -> dark),
  // so the 6 dots on the card surface the colours people actually order.
  const enabled = enabledColours(product);
  const colours = sortColours(enabled);
  // Cap at 4 dots so they never squash in narrow card columns (grid-cols-2 at
  // 320px leaves ~104px); the "+N" count absorbs the rest.
  const swatches = colours.slice(0, 4);
  const extra = colours.length - swatches.length;

  // Default the card image to the hero colour (owner's pinned pick, else the
  // first bold colour), otherwise every card opens on its blank-looking white
  // colorway. selected can be -1 when the hero isn't among the 6 visible dots.
  // Prefer the on-model shot (falls back to flat), honouring the hero's pinned view.
  const hero = heroColour(enabled);
  const heroIdx = hero ? swatches.findIndex((c) => c.name === hero.name) : -1;
  const [selected, setSelected] = useState(heroIdx);
  const activeImage =
    (selected >= 0 ? colourCardImage(swatches[selected]) : colourCardImage(hero)) ?? fallbackImage;

  // Remember the exact shop listing this card was clicked from (incl. category /
  // search / sort) so the product page's "Back to shop" returns here, not to the
  // product's own category. Only carry it when we're actually on /shop.
  const pathname = usePathname();
  const search = useSearchParams();
  const from =
    pathname === "/shop"
      ? `/shop${search.toString() ? `?${search.toString()}` : ""}`
      : null;
  const href = from
    ? `/shop/${product.id}?from=${encodeURIComponent(from)}`
    : `/shop/${product.id}`;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-dream-line bg-white",
        "shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-dream-purple hover:shadow-[0_8px_0_0_rgba(27,20,88,0.9)]",
        "focus-within:ring-2 focus-within:ring-dream-purple/40",
        className,
      )}
    >
      {/* Overlay link, covers the whole card; swatches sit above it (z-20). */}
      <Link
        href={href}
        aria-label={product.name}
        className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
      />

      <div className="relative aspect-square w-full overflow-hidden bg-white">
        {featured && (
          <span
            title="Top pick"
            className="absolute left-2 top-2 z-20 inline-flex items-center justify-center gap-1 rounded-full bg-dream-sun font-display text-[14px] font-bold text-white shadow-sm max-sm:h-7 max-sm:w-7 max-sm:text-sm sm:px-2.5 sm:py-1"
          >
            <span aria-hidden>★</span>
            <span className="max-sm:sr-only">Top pick</span>
          </span>
        )}
        {activeImage ? (
          <Image
            src={activeImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"
            className="object-contain p-1.5 transition-transform duration-200 group-hover:scale-[1.05] sm:p-4"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-dream-lavender-soft">
            <ShirtIcon className="h-12 w-12 text-dream-lavender-deep/60" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        {/* Reserve exactly two lines of title. That is what keeps every card's
            text block the same height, so swatch rows and prices line up across
            a row. The old value was slightly too short for a real two-line name
            (18px at leading-snug), so taller cards spilled past it and shorter
            ones opened a gap; these values fit brand + two lines exactly.
            justify-end puts any slack ABOVE the brand, where it reads as part
            of the gap under the photo rather than a hole in the card. */}
        <div className="flex min-h-[3.5rem] flex-col justify-end gap-0.5 sm:min-h-[4.5rem]">
          {product.brand && (
            <span className="text-[14px] font-semibold uppercase tracking-wide text-dream-purple sm:text-[14px]">
              {product.brand}
            </span>
          )}
          <h3 className="line-clamp-2 font-display text-[14px] font-semibold leading-snug text-dream-ink sm:text-lg">
            {product.name}
          </h3>
        </div>

        {swatches.length > 0 && (
          <div className="relative z-20 flex flex-wrap items-center gap-1.5">
            {swatches.map((c, i) => (
              <button
                key={`${c.name}-${i}`}
                type="button"
                title={c.name}
                aria-label={`Show ${c.name}`}
                aria-pressed={i === selected}
                onClick={() => setSelected(i)}
                className={cn(
                  "h-[22px] w-[22px] shrink-0 rounded-full border border-dream-line transition-transform hover:scale-110",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
                  i === selected && "ring-2 ring-dream-purple ring-offset-1 ring-offset-white",
                )}
                style={swatchStyle(c)}
              />
            ))}
            {extra > 0 && (
              <span className="ml-0.5 text-[14px] font-medium text-dream-faint">
                +{extra}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto border-t border-dream-line pt-2.5 sm:pt-3">
          {/* Priced at the shared shop quantity for a minimum print (1 colour,
              1 location), not the top-volume "as low as" teaser. */}
          <span className="inline-flex flex-nowrap items-baseline gap-x-1 self-start whitespace-nowrap font-display text-[15px] font-bold text-dream-ink sm:gap-x-1.5 sm:text-lg">
            {/* 10px: this row has to fit "AT 25 UNITS $18.58 /unit" on one line
                inside a half-width card on a 320px phone. */}
            <span className="text-[10px] font-semibold uppercase tracking-wide text-dream-ink/55">
              {price.label}
            </span>
            {formatCAD(price.amount)}
            <span className="text-[10px] font-semibold text-dream-ink/55">/unit</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ShirtIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </svg>
  );
}
