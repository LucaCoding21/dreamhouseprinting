import React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { startingAtPrice } from "@/lib/pricing/platform";
import { productPrimaryImage, enabledColours } from "@/lib/productImage";
import type { ProductRow } from "@/lib/db/rows";

/**
 * Catalog product card — image, brand, name, "from $X", a few colour dots.
 * The whole card links into the designer (/design/[id], PRD §3.3.2); that route
 * lands in a later phase, but linking here is correct now.
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
  const image = productPrimaryImage(product);
  const colours = enabledColours(product);
  const swatches = colours.slice(0, 5);
  const extra = colours.length - swatches.length;

  return (
    <Link
      href={`/shop/${product.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-dream-line bg-white",
        "shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-dream-purple hover:shadow-[0_8px_0_0_rgba(27,20,88,0.9)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
        className,
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-white">
        {featured && (
          <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-dream-sun px-2.5 py-1 font-display text-xs font-bold text-white shadow-sm">
            <span aria-hidden>★</span> Top pick
          </span>
        )}
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"
            className="object-contain p-4 transition-transform duration-200 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-dream-lavender-soft">
            <ShirtIcon className="h-12 w-12 text-dream-lavender-deep/60" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex min-h-[3.25rem] flex-col justify-end gap-0.5">
          {product.brand && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-dream-faint">
              {product.brand}
            </span>
          )}
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-dream-ink">
            {product.name}
          </h3>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2.5">
          {swatches.length > 0 ? (
            <span className="flex items-center gap-1" aria-hidden="true">
              {swatches.map((c, i) => (
                <span
                  key={`${c.name}-${i}`}
                  title={c.name}
                  className="h-3.5 w-3.5 rounded-full border border-dream-line"
                  style={{ backgroundColor: c.hex || "#ddd" }}
                />
              ))}
              {extra > 0 && (
                <span className="text-[11px] font-medium text-dream-faint">
                  +{extra}
                </span>
              )}
            </span>
          ) : (
            <span />
          )}
          <span className="inline-flex items-baseline gap-1 font-display text-sm font-bold text-dream-ink">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-dream-ink/55">from</span>
            {formatCAD(startingAtPrice(product))}
          </span>
        </div>
      </div>
    </Link>
  );
}

function ShirtIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </svg>
  );
}
