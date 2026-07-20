"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/login/actions";
import type { StaffPermission } from "@/lib/auth";

type IconProps = { className?: string };
type Icon = (p: IconProps) => React.ReactElement;

interface NavItem {
  label: string;
  href: string;
  perm?: StaffPermission;
  Icon: Icon;
}

const svg = (paths: React.ReactNode): Icon =>
  function NavIcon({ className }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {paths}
      </svg>
    );
  };

const IconDashboard = svg(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </>
);
const IconOrders = svg(
  <>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </>
);
const IconProducts = svg(
  <>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </>
);
const IconPricing = svg(
  <>
    <path d="M12 1v22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </>
);
const IconCustomers = svg(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
);
const IconSettings = svg(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>
);

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", Icon: IconDashboard },
  { label: "Orders", href: "/admin/orders", perm: "orders.view", Icon: IconOrders },
  { label: "Products", href: "/admin/products", perm: "products.manage", Icon: IconProducts },
  { label: "Pricing", href: "/admin/pricing", perm: "products.manage", Icon: IconPricing },
  { label: "Customers", href: "/admin/customers", perm: "customers.view", Icon: IconCustomers },
  { label: "Settings", href: "/admin/settings", perm: "settings.manage", Icon: IconSettings },
];

const STORAGE_KEY = "dh_admin_sidebar_collapsed";

export function AdminSidebar({
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

  // Collapsed state is remembered per browser so it survives navigation and
  // reloads. Start expanded and sync from storage on mount (avoids an SSR
  // hydration mismatch, the brief expand-then-collapse is imperceptible).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* storage disabled, collapse still works for the session */
      }
      return next;
    });

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col bg-dream-ink text-white transition-[width] duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand + collapse toggle */}
      <div
        className={cn(
          "flex items-center gap-3 py-5",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-bold leading-tight">Dreamhouse Printing</div>
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-white/40">Admin</div>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
            <path d="M9 4.5v15" />
            {!collapsed && <rect x="3" y="4.5" width="6" height="15" rx="2.5" fill="currentColor" stroke="none" />}
          </svg>
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {items.map((item) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          const badge = badges[item.href] ?? 0;
          const { Icon } = item;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                active ? "bg-dream-purple text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <span className="relative grid shrink-0 place-items-center">
                <Icon className="h-[18px] w-[18px]" />
                {/* When collapsed there's no room for a number, so a badge shows
                    as a small dot on the icon. */}
                {collapsed && badge > 0 && (
                  <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-dream-purple ring-2 ring-dream-ink" />
                )}
              </span>
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && badge > 0 && (
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

      <div className={cn("border-t border-white/10 py-4", collapsed ? "px-2" : "px-4")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-dream-purple text-xs font-bold"
              title={`${name || "Staff"} · ${role.replace("_", " ")}`}
            >
              {name.slice(0, 2).toUpperCase() || "DH"}
            </div>
            <form action={signOutAction}>
              <button
                aria-label="Sign out"
                title="Sign out"
                className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dream-purple text-xs font-bold">
                {name.slice(0, 2).toUpperCase() || "DH"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{name || "Staff"}</div>
                <div className="text-[11px] capitalize text-white/40">{role.replace("_", " ")}</div>
              </div>
            </div>
            <form action={signOutAction} className="mt-3">
              <button className="w-full rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white">
                Sign out
              </button>
            </form>
          </>
        )}
      </div>
    </aside>
  );
}
