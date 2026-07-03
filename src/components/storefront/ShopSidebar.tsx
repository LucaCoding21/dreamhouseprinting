import React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { CategoryRow } from "@/lib/db/rows";

/**
 * Shop All sidebar (PRD §3.3.1): major categories, each able to show its child
 * subcategories indented beneath it (Shirts → Short Sleeve, Long Sleeve, …). The
 * active category (from the URL) is highlighted. Server component: pure links.
 */
export function ShopSidebar({
  categories,
  activeSlug,
  className,
}: {
  categories: CategoryRow[];
  activeSlug?: string;
  className?: string;
}) {
  const majors = categories
    .filter((c) => c.is_major && !c.parent_id)
    .sort((a, b) => a.display_order - b.display_order);

  const childrenOf = (parentId: string) =>
    categories
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.display_order - b.display_order);

  const isActive = (slug: string) => activeSlug === slug;

  return (
    <nav
      aria-label="Catalog categories"
      className={cn(
        "rounded-2xl border border-dream-line bg-dream-lavender-mist p-3 text-sm",
        className,
      )}
    >
      <Link
        href="/shop"
        className={cn(
          "mb-1 block rounded-lg px-3 py-2 font-display font-semibold transition-colors",
          !activeSlug
            ? "bg-dream-lavender-soft text-dream-purple-selected"
            : "text-dream-ink hover:bg-dream-lavender-soft",
        )}
      >
        All Products
      </Link>

      <ul className="space-y-0.5">
        {majors.map((cat) => {
          const subs = childrenOf(cat.id);
          return (
            <li key={cat.id}>
              <Link
                href={`/shop?category=${cat.slug}`}
                className={cn(
                  "block rounded-lg px-3 py-2 font-display font-semibold transition-colors",
                  isActive(cat.slug)
                    ? "bg-dream-lavender-soft text-dream-purple-selected"
                    : "text-dream-ink hover:bg-dream-lavender-soft",
                )}
              >
                {cat.name}
              </Link>
              {subs.length > 0 && (
                <ul className="mb-1 ml-3 border-l border-dream-line pl-2">
                  {subs.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/shop?category=${sub.slug}`}
                        className={cn(
                          "block rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                          isActive(sub.slug)
                            ? "font-medium text-dream-purple-selected"
                            : "text-dream-muted hover:bg-dream-lavender-soft hover:text-dream-ink",
                        )}
                      >
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
