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
    <header className="border-b border-dream-line bg-dream-lavender-soft">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center">
          <Image src="/dreamhouse-logo-full.png" alt="Dreamhouse Printing" width={900} height={300} className="h-9 w-auto sm:h-10" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-medium text-dream-ink-soft sm:block">{name}</span>
          <form action={signOutAction}>
            <button className="rounded-full bg-white px-4 py-2 text-xs font-bold text-dream-ink shadow-sm transition-transform hover:-translate-y-0.5">
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
                "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
                active
                  ? "border-dream-purple text-dream-purple"
                  : "border-transparent text-dream-ink-soft hover:text-dream-ink"
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
