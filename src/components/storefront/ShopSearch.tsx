"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Catalog search field for the shop hero, pushes to /shop?search=… */
export function ShopSearch() {
  const router = useRouter();
  const params = useSearchParams();
  // Mirror the URL, don't just seed from it: switching category navigates to a
  // /shop URL with no `search`, and a field that kept its own initial state
  // went on showing a term the results were no longer filtered by. Synced
  // during render (not in an effect) so there is no flash of the stale value.
  const urlQuery = params.get("search") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative w-full lg:w-[26rem]">
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dream-faint" />
      <input
        type="search"
        name="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search shirts, hoodies, hats…"
        aria-label="Search the catalog"
        className="h-11 w-full rounded-full border border-dream-line bg-white pl-10 pr-4 text-sm text-dream-ink shadow-sm placeholder:text-dream-faint focus-visible:border-dream-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
      />
    </form>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
