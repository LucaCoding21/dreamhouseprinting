import Link from "next/link";

/**
 * Phone-only way home from a portal sub-page. The sidebar that carries the
 * Dashboard link is gone below sm, so a page reached from "View all orders"
 * or the bottom nav had no route back except the browser.
 */
export function BackToDashboard() {
  return (
    <Link
      href="/account"
      className="flex w-fit flex-row items-center gap-1 text-left font-display text-sm font-bold text-dream-purple underline-offset-4 hover:underline sm:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14.5 5.5L8 12l6.5 6.5" />
      </svg>
      {/* Archivo sits high in its line box, so nudge the word down to meet the arrow. */}
      <span className="translate-y-[1.5px]">Dashboard</span>
    </Link>
  );
}
