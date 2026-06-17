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
}: {
  product: ProductRow;
  className?: string;
}) {
  const image = productPrimaryImage(product);
  const colours = enabledColours(product);
  const swatches = colours.slice(0, 5);
  const extra = colours.length - swatches.length;

  return (
    <Link
      href={`/shop/${product.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-dream-line bg-dream-surface",
        "shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-dream-line-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
        className,
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-dream-bg">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"
            className="object-contain p-4 transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-dream-lavender-soft">
            <ShirtIcon className="h-12 w-12 text-dream-lavender-deep/60" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.brand && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-dream-faint">
            {product.brand}
          </span>
        )}
        <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-dream-ink">
          {product.name}
        </h3>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm text-dream-muted">
            from{" "}
            <span className="font-display font-semibold text-dream-ink">
              {formatCAD(startingAtPrice(product))}
            </span>
          </span>
          {swatches.length > 0 && (
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
          )}
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
