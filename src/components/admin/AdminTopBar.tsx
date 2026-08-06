"use client";

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

/**
 * Slim horizontal admin nav. It replaced the left sidebar so wide pages (the
 * order detail line items above all) get the full window width; the chrome
 * only costs one bar of height instead of a permanent column.
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
    <header className="z-30 shrink-0 bg-dream-ink text-white">
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Brand, back to the admin home */}
        <Link href="/admin" className="flex shrink-0 items-baseline gap-2 rounded-lg px-1 py-1">
          <span className="font-display text-[15px] font-bold leading-none">Dreamhouse</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Admin</span>
        </Link>

        {/* Links. Scrolls sideways on narrow screens rather than wrapping, so
            the bar keeps its fixed height. */}
        <nav className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
          {items.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
          className="flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
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
  );
}
