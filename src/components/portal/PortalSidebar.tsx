"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/login/actions";
import { PORTAL_NAV, isNavActive } from "./nav";
import { IconSignOut, IconHelp } from "./icons";

export function PortalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-dream-line bg-white px-4 py-5 lg:flex">
      <Link href="/" className="mb-8 flex items-center px-2">
        <Image
          src="/dreamhouse-logo4.svg"
          alt="Dreamhouse Printing"
          width={1668}
          height={547}
          className="h-11 w-auto"
        />
      </Link>

      <nav className="flex flex-col gap-1">
        {PORTAL_NAV.map(({ label, href, Icon }) => {
          const active = isNavActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-dream-lavender-soft text-dream-purple"
                  : "text-dream-ink-soft hover:bg-dream-lavender-mist hover:text-dream-ink"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Help promo, pinned toward the bottom */}
      <div className="mt-auto rounded-lg border border-dream-line bg-dream-lavender-mist p-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-dream-purple">
          <IconHelp className="h-5 w-5" />
        </span>
        <p className="mt-3 font-display text-sm font-bold text-dream-ink">Need help with an order?</p>
        <p className="mt-1 text-[14px] text-dream-muted">Our team is here to help you every step of the way.</p>
        <Link
          href="/account/help"
          className="mt-3 inline-flex items-center justify-center rounded-full bg-dream-purple px-4 py-2 text-[14px] font-bold text-white transition-transform hover:-translate-y-0.5"
        >
          Contact Support
        </Link>
      </div>

      <form action={signOutAction} className="mt-4 border-t border-dream-line pt-4">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-dream-ink-soft transition-colors hover:bg-dream-lavender-mist hover:text-dream-ink">
          <IconSignOut className="h-5 w-5" />
          Sign out
        </button>
      </form>
    </aside>
  );
}
