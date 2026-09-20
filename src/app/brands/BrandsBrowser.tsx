"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { BRANDS, BRAND_TABS, brandHref, type BrandCategory } from "@/lib/brands";

/**
 * Search + category tabs + the brand list. Client-side because the filtering is
 * instant over a fixed 10-item list, so there is nothing worth a round trip.
 */
export function BrandsBrowser() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<BrandCategory | "all">("all");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BRANDS.filter((b) => {
      const inTab = tab === "all" || b.categories.includes(tab);
      if (!inTab) return false;
      if (!q) return true;
      return (
        b.label.toLowerCase().includes(q) ||
        b.blurb.toLowerCase().includes(q) ||
        b.brand.toLowerCase().includes(q)
      );
    });
  }, [query, tab]);

  return (
    <div>
      {/* Controls. Stacked on phones; from md the search sits beside the
          category tabs instead of stretching the full width of a wide page. */}
      <div className="mt-8 flex flex-col gap-6 sm:mt-10 md:flex-row-reverse md:items-center md:justify-between md:gap-8">
      <div className="relative md:w-[20rem] md:shrink-0">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-dream-faint" />
        {/* type="text", not "search": WebKit adds its own clear button to a
            search input, which sat on top of ours and showed two X's. */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brands"
          aria-label="Search brands"
          className="h-14 w-full rounded-xl border border-dream-line bg-white pl-12 pr-11 text-[15px] text-dream-ink placeholder:text-dream-faint focus:border-dream-purple focus:outline-none focus:ring-2 focus:ring-dream-purple/25"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-dream-faint transition-colors hover:bg-dream-bg hover:text-dream-ink"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>

      {/* Category tabs. Scrolls sideways on narrow phones rather than wrapping,
          so the row stays one line like the rest of the site's chip rows. */}
      <div
        role="tablist"
        aria-label="Filter brands by category"
        className="no-scrollbar -mx-4 flex gap-7 overflow-x-auto px-4 sm:mx-0 sm:justify-start sm:px-0"
      >
        {BRAND_TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.value)}
              className={cn(
                "shrink-0 border-b-2 pb-2 text-[15px] font-semibold transition-colors",
                active
                  ? "border-dream-purple text-dream-purple"
                  : "border-transparent text-dream-muted hover:text-dream-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      </div>

      {/* Brand list. One row per brand on a phone; a card grid from sm up, so a
          wide screen shows the range at a glance instead of one long column
          with the page's width unused on either side. */}
      {results.length > 0 ? (
        <ul className="mt-2 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-x-10 sm:gap-y-9 lg:grid-cols-3 lg:gap-x-14">
          {results.map((b) => (
            <li key={b.brand}>
              <Link
                href={brandHref(b.brand)}
                className="group flex items-center gap-6 border-b border-dream-line py-5 transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40 sm:h-full sm:flex-col sm:items-start sm:gap-3.5 sm:border-b-0 sm:border-t sm:border-dream-line sm:pt-6 sm:pb-0 sm:hover:bg-transparent"
              >
                {/* Real wordmark where we have the asset; the remaining brands
                    fall back to a letterform until their logo is added. */}
                <span aria-hidden className="grid w-20 shrink-0 place-items-center sm:h-12 sm:w-full sm:justify-items-start">
                  {b.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.logo}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="max-h-9 w-full object-contain object-left sm:max-h-11 sm:max-w-[9rem]"
                    />
                  ) : (
                    <span
                      className={cn(
                        "font-display text-[30px] font-extrabold leading-none tracking-tight sm:text-[38px]",
                        b.accent ? "text-dream-purple" : "text-dream-ink",
                      )}
                    >
                      {b.monogram}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 sm:w-full sm:flex-none">
                  <span className="block font-display text-[17px] font-bold text-dream-ink transition-colors group-hover:text-dream-purple sm:flex sm:items-center sm:gap-1.5 sm:text-lg">
                    {b.label}
                    <ChevronIcon className="hidden h-3.5 w-3.5 shrink-0 text-dream-faint transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-dream-purple sm:inline-block" />
                  </span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-dream-muted sm:text-[15px]">
                    {b.blurb}
                  </span>
                </span>
                {/* A quiet chevron, not a full arrow: it repeats on every row,
                    so at ink weight it competed with the brand names. Solid
                    dream-faint (not an opacity tint) keeps it crisp, and it
                    picks up purple on hover where the attention belongs. */}
                <ChevronIcon className="h-4 w-4 shrink-0 text-dream-faint transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-dream-purple sm:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-center text-[15px] text-dream-muted">
          No brands match {query.trim() ? `"${query.trim()}"` : "that filter"}. Try another search.
        </p>
      )}
    </div>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
