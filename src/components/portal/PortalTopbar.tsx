"use client";

import Link from "next/link";
import Image from "next/image";
import { PortalMobileMenu } from "./PortalMobileMenu";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function PortalTopbar({ name }: { name: string }) {
  // Below lg the section nav (and sign out) live in the hamburger menu, so the
  // top bar is one slim row: logo, avatar, menu button. --portal-topbar-h
  // tells the menu sheet where to hang from (h-9 controls + py-2.5 + border).
  return (
    // Solid background (was 85% + blur): content scrolling under a translucent
    // sticky bar read as "cut off" at the top of the page.
    <div
      className="sticky top-0 z-40 border-b border-dream-line bg-[#f8f7fd] [--portal-topbar-h:calc(2.5rem+1.5rem+1px)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-8">
        {/* Logo only on mobile (desktop has it in the sidebar) */}
        <Link href="/" className="flex shrink-0 items-center lg:hidden">
          <Image
            src="/dreamhouse-logo4.svg"
            alt="Dreamhouse Printing"
            width={1668}
            height={547}
            className="h-10 w-auto"
          />
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-dream-purple text-sm font-bold text-white"
            title={name}
          >
            {initialsOf(name)}
          </span>
          <PortalMobileMenu name={name} />
        </div>
      </div>
    </div>
  );
}
