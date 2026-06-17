"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/login/actions";

const NAV = [
  { label: "Dashboard", href: "/account" },
  { label: "My Orders", href: "/account/orders" },
  { label: "My Designs", href: "/account/designs" },
  { label: "Account", href: "/account/settings" },
  { label: "Help", href: "/account/help" },
];

export function PortalNav({ name }: { name: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-dream-line bg-dream-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/dreamhouse-logo.svg" alt="Dreamhouse Printing" width={32} height={32} />
          <span className="font-display text-lg font-bold text-dream-ink">Dreamhouse</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-dream-muted sm:block">{name}</span>
          <form action={signOutAction}>
            <button className="rounded-lg border border-dream-line px-3 py-1.5 text-xs font-medium text-dream-ink hover:bg-dream-bg">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
        {NAV.map((item) => {
          const active =
            item.href === "/account" ? pathname === "/account" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-dream-purple text-dream-purple"
                  : "border-transparent text-dream-muted hover:text-dream-ink"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
