"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/login/actions";
import type { StaffPermission } from "@/lib/auth";

interface NavItem {
  label: string;
  href: string;
  perm?: StaffPermission;
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Orders", href: "/admin/orders", perm: "orders.view" },
  { label: "Proofs & Artwork", href: "/admin/proofs", perm: "proofs.manage" },
  { label: "Production", href: "/admin/production", perm: "production.manage" },
  { label: "Products", href: "/admin/products", perm: "products.manage" },
  { label: "Quotes", href: "/admin/quotes", perm: "quotes.manage" },
  { label: "Customers", href: "/admin/customers", perm: "customers.view" },
  { label: "Reports", href: "/admin/reports", perm: "reports.view" },
  { label: "Settings", href: "/admin/settings", perm: "settings.manage" },
];

export function AdminSidebar({
  name,
  role,
  permissions,
  badges = {},
}: {
  name: string;
  role: string;
  permissions: string[];
  /** Notification counts keyed by nav href, e.g. { "/admin/proofs": 3 }. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const isAdmin = role === "staff_admin";
  const can = (perm?: StaffPermission) => !perm || isAdmin || permissions.includes(perm);

  const items = NAV.filter((i) => can(i.perm));

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-dream-ink text-white">
      <div className="px-5 py-5">
        <div className="font-display text-base font-bold leading-tight">Dreamhouse Printing</div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Admin</div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {items.map((item) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          const badge = badges[item.href] ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-dream-purple text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <span>{item.label}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                    active ? "bg-white text-dream-purple" : "bg-dream-purple text-white"
                  )}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-dream-purple text-xs font-bold">
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
      </div>
    </aside>
  );
}
