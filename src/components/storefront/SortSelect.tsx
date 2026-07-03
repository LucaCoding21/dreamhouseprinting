"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A–Z" },
];

/** Sort dropdown — updates the ?sort= param, preserving category/search. */
export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(v: string) {
    const p = new URLSearchParams(params.toString());
    if (v === "featured") p.delete("sort");
    else p.set("sort", v);
    router.push(`/shop?${p.toString()}`, { scroll: false });
  }

  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Sort products"
        className="h-11 appearance-none rounded-full border border-dream-line bg-white pl-4 pr-9 text-sm font-medium text-dream-ink shadow-sm focus-visible:border-dream-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronIcon className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dream-faint" />
    </div>
  );
}

function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
