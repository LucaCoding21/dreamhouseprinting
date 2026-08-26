"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/login/actions";
import { PORTAL_NAV, isNavActive } from "./nav";
import { IconSignOut } from "./icons";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function PortalTopbar({ name }: { name: string }) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-20 border-b border-dream-line bg-[#f8f7fd]/85 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-5 py-3 lg:px-8">
        {/* Logo only on mobile (desktop has it in the sidebar) */}
        <Link href="/" className="flex items-center lg:hidden">
          <Image src="/dreamhouse-logo-full.png" alt="Dreamhouse Printing" width={900} height={300} className="h-8 w-auto" />
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-dream-purple text-[14px] font-bold text-white"
            title={name}
          >
            {initialsOf(name)}
          </span>
          {/* Mobile sign-out (desktop has it in the sidebar) */}
          <form action={signOutAction} className="lg:hidden">
            <button
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 place-items-center rounded-full border border-dream-line bg-white text-dream-ink-soft transition-colors hover:text-dream-ink"
            >
              <IconSignOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Mobile section nav (desktop uses the sidebar) */}
      <nav className="flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden">
        {PORTAL_NAV.map(({ label, href, Icon }) => {
          const active = isNavActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "border-dream-purple text-dream-purple"
                  : "border-transparent text-dream-ink-soft hover:text-dream-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
