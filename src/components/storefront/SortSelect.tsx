"use client";

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
    <label className="inline-flex items-center gap-2 text-sm text-dream-muted">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-dream-line bg-white px-3 py-1.5 text-sm font-medium text-dream-ink focus-visible:border-dream-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
