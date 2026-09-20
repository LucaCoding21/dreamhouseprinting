"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/login/actions";
import { PORTAL_NAV, isNavActive } from "./nav";
import { IconSignOut } from "./icons";

/**
 * Phone-only portal nav: a hamburger button in the top bar that opens a sheet
 * under it with the five sections + sign out. Hidden from lg up, where
 * PortalSidebar renders the full nav instead.
 */
export function PortalMobileMenu({ name }: { name: string }) {
  const pathname = usePathname();
  // Stores the route the menu was opened on rather than a boolean, so any
  // navigation (a tap on one of its own links included) closes it for free.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenedAt(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="portal-mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="grid h-10 w-10 place-items-center rounded-full border border-dream-line bg-white text-dream-ink transition-colors hover:text-dream-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple focus-visible:ring-offset-2 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {/* Always mounted so it can animate both ways. The wrapper is
          pointer-events-none because it is positioned inside the sticky top
          bar's stacking context and would otherwise sit over the bar and eat
          the tap meant for the X; only the scrim and sheet take pointer events
          while open. `invisible` lands at the END of the closing transition
          (visibility animates discretely), so the sheet finishes sliding up
          before it stops being rendered. */}
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-30 transition-[visibility] duration-300 lg:hidden",
          open ? "visible" : "invisible"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
      >
        {/* Scrim starts below the top bar so the bar (and its X) stay
            un-dimmed and tappable. */}
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label="Close menu"
          onClick={() => setOpenedAt(null)}
          className={cn(
            "absolute inset-x-0 bottom-0 top-[var(--portal-topbar-h,3.5rem)] w-full bg-dream-overlay/40 transition-opacity duration-300",
            open ? "pointer-events-auto opacity-100" : "opacity-0"
          )}
        />
        {/* Clip region: the sheet slides up behind the top bar rather than
            over it (the bar's content is not positioned, so without this the
            sheet would paint across the logo mid-animation). */}
        <div className="absolute inset-x-0 bottom-0 top-[var(--portal-topbar-h,3.5rem)] overflow-hidden">
          <div
            id="portal-mobile-menu"
            className={cn(
              "max-h-full overflow-y-auto border-b border-dream-line bg-white shadow-[0_16px_32px_-16px_rgba(27,20,88,0.35)] transition-transform duration-300 ease-out motion-reduce:transition-none",
              open ? "pointer-events-auto translate-y-0" : "-translate-y-full"
            )}
          >
            <nav className="p-2">
              {PORTAL_NAV.map(({ label, href, Icon }) => {
                const active = isNavActive(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    tabIndex={open ? 0 : -1}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-semibold",
                      active ? "bg-dream-lavender-soft text-dream-purple" : "text-dream-ink"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-dream-line p-2">
              <div className="flex h-11 items-center px-3 text-sm text-dream-muted">
                <span className="truncate">Signed in as {name}</span>
              </div>
              <form action={signOutAction}>
                <button
                  tabIndex={open ? 0 : -1}
                  className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-dream-ink-soft hover:bg-dream-lavender-mist hover:text-dream-ink"
                >
                  <IconSignOut className="h-5 w-5 shrink-0" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
