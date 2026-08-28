"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/login/actions";
import { AdminMobileTabs } from "@/components/admin/AdminMobileTabs";
import { NAV, isNavActive } from "@/components/admin/adminNav";
import type { StaffPermission } from "@/lib/auth";

/**
 * Slim horizontal admin nav. It replaced the left sidebar so wide pages (the
 * order detail line items above all) get the full window width; the chrome
 * only costs one bar of height instead of a permanent column.
 *
 * Below md the links move out of this bar entirely and into the fixed bottom
 * tab bar (AdminMobileTabs), leaving one slim row of brand plus account.
 */
export function AdminTopBar({
  name,
  role,
  permissions,
  badges = {},
}: {
  name: string;
  role: string;
  permissions: string[];
  /** Notification counts keyed by nav href, e.g. { "/admin/orders": 3 }. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const isAdmin = role === "staff_admin";
  const can = (perm?: StaffPermission) => !perm || isAdmin || permissions.includes(perm);
  const items = NAV.filter((i) => can(i.perm));

  return (
    <>
      <header className="z-30 shrink-0 bg-dream-ink text-white">
        <div className="flex h-14 items-center gap-x-4 px-4">
          {/* Brand, back to the admin home */}
          <Link href="/admin" className="flex shrink-0 items-baseline gap-2 rounded-lg px-1 py-1">
            <span className="font-display text-[15px] font-bold leading-none">Dreamhouse</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Admin</span>
          </Link>

          {/* Links, md and up only. They scroll sideways rather than wrap so the
              bar keeps its fixed height on narrow laptops. */}
          <nav className="no-scrollbar -mx-1 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 md:flex">
            {items.map((item) => {
              const active = isNavActive(item.href, pathname);
              const badge = badges[item.href] ?? 0;
              const { Icon } = item;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-dream-purple text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-[17px] w-[17px] shrink-0" />
                  <span>{item.label}</span>
                  {badge > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none tabular-nums",
                        active ? "bg-white text-dream-purple" : "bg-dream-purple text-white"
                      )}
                    >
                      <span className="translate-y-[0.5px]">{badge > 99 ? "99+" : badge}</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* The customer-facing site, in its own tab so the admin page you were
              working on stays open and unsaved edits survive. */}
          <Link
            href="/"
            target="_blank"
            rel="noopener"
            title="View the shop in a new tab"
            className="ml-auto flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white md:ml-0"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px] shrink-0"
              aria-hidden
            >
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8" />
              <path d="M9.5 21v-6h5v6" />
            </svg>
            <span className="hidden sm:inline">View shop</span>
          </Link>

          {/* Who's signed in, plus the way out */}
          <div className="flex shrink-0 items-center gap-2 border-l border-white/10 pl-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-dream-purple text-[11px] font-bold"
              title={`${name || "Staff"} · ${role.replace("_", " ")}`}
            >
              {name.slice(0, 2).toUpperCase() || "DH"}
            </div>
            <div className="hidden min-w-0 leading-tight lg:block">
              <div className="max-w-[140px] truncate text-xs font-medium">{name || "Staff"}</div>
              <div className="text-[11px] capitalize text-white/40">{role.replace("_", " ")}</div>
            </div>
            <form action={signOutAction}>
              <button
                aria-label="Sign out"
                title="Sign out"
                className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </header>

      <AdminMobileTabs items={items} badges={badges} name={name} role={role} />
    </>
  );
}
