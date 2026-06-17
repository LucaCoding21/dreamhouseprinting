"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Storefront header (PRD §3.3.1): logo, a catalog search field that pushes to
 * /shop?search=…, an account link, and a cart icon. Clean white bar with a
 * subtle bottom border — the SaaS aesthetic carried across the storefront.
 */
export function StorefrontNav() {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("search") ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-dream-line bg-dream-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Dreamhouse Printing home"
          className="flex shrink-0 items-center gap-2"
        >
          <Image
            src="/dreamhouse-logo.svg"
            alt="Dreamhouse Printing"
            width={36}
            height={36}
            className="h-9 w-9"
            priority
          />
          <span className="hidden font-display text-base font-semibold text-dream-ink sm:inline">
            Dreamhouse
          </span>
        </Link>

        <form onSubmit={onSubmit} className="relative flex-1 max-w-xl" role="search">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dream-faint" />
          <Input
            type="search"
            name="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shirts, hoodies, hats…"
            aria-label="Search the catalog"
            className="h-10 pl-9"
          />
        </form>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/account"
            className={cn(
              "hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-dream-muted",
              "transition-colors hover:bg-dream-bg hover:text-dream-ink sm:inline-flex",
            )}
          >
            <UserIcon className="h-4 w-4" />
            Log in
          </Link>
          <Link
            href="/account"
            aria-label="Account"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-dream-muted transition-colors hover:bg-dream-bg hover:text-dream-ink sm:hidden"
          >
            <UserIcon className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-dream-muted transition-colors hover:bg-dream-bg hover:text-dream-ink"
          >
            <CartIcon className="h-5 w-5" />
          </Link>
        </nav>
      </div>
    </header>
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

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}
