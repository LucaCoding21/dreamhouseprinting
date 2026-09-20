"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/login/actions";
import {
  IconMore,
  IconShop,
  IconSignOut,
  isNavActive,
  type NavItem,
} from "@/components/admin/adminNav";

/** Order the three route tabs compete for, best first. Whatever the signed-in
 *  staffer cannot see drops out and the next one is promoted. */
const TAB_PRIORITY = ["/admin", "/admin/orders", "/admin/customers", "/admin/products"];

/**
 * Phone-only chrome: a fixed bottom tab bar plus a "More" sheet for the nav
 * items that did not win a tab. Hidden from md up, where AdminTopBar renders
 * the full inline nav instead.
 */
export function AdminMobileTabs({
  items,
  badges,
  name,
  role,
}: {
  /** Already permission-filtered, in NAV order. */
  items: NavItem[];
  badges: Record<string, number>;
  name: string;
  role: string;
}) {
  const pathname = usePathname();
  // The sheet stores the route it was opened on rather than a boolean, so any
  // navigation (a tap on one of its own rows included) closes it with no effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const sheetOpen = openedAt === pathname;
  const setSheetOpen = (open: boolean) => setOpenedAt(open ? pathname : null);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const tabs = TAB_PRIORITY.map((href) => items.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, 3);
  const rest = items.filter((i) => !tabs.includes(i));
  const moreActive = rest.some((i) => isNavActive(i.href, pathname));
  const initials = name.slice(0, 2).toUpperCase() || "DH";
  const roleLabel = role.replace("_", " ");

  return (
    <>
      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 h-full w-full bg-dream-overlay/50"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-dream-surface pb-[env(safe-area-inset-bottom)] text-dream-ink shadow-[0_-10px_30px_rgba(27,20,88,0.2)]">
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-dream-line-strong" />
            <div className="p-2">
              {rest.map((item) => {
                const active = isNavActive(item.href, pathname);
                const { Icon } = item;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                      active ? "bg-dream-lavender-mist text-dream-purple" : "text-dream-ink"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="my-1.5 border-t border-dream-line" />

              <a
                href="/"
                target="_blank"
                rel="noopener"
                className="flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-dream-ink"
              >
                <IconShop className="h-5 w-5 shrink-0" />
                <span>View shop</span>
              </a>

              <div className="flex h-12 items-center gap-3 px-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dream-purple text-[11px] font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-medium">{name || "Staff"}</div>
                  <div className="text-xs capitalize text-dream-muted">{roleLabel}</div>
                </div>
              </div>

              <form action={signOutAction}>
                <button className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-dream-danger">
                  <IconSignOut className="h-5 w-5 shrink-0" />
                  <span>Sign out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-dream-ink pb-[env(safe-area-inset-bottom)] text-white md:hidden"
      >
        <div className="flex items-stretch">
          {tabs.map((item) => {
            const active = isNavActive(item.href, pathname);
            const badge = badges[item.href] ?? 0;
            const { Icon } = item;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-2",
                  active ? "text-white" : "text-white/55"
                )}
              >
                <span className="relative">
                  <Icon className={cn("h-6 w-6", active && "text-dream-lavender")} />
                  {badge > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-dream-purple px-1 text-[10px] font-bold leading-none tabular-nums text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setSheetOpen(!sheetOpen)}
            aria-expanded={sheetOpen}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-2",
              sheetOpen || moreActive ? "text-white" : "text-white/55"
            )}
          >
            <IconMore className={cn("h-6 w-6", (sheetOpen || moreActive) && "text-dream-lavender")} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
