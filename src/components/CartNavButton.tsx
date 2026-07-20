"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/cart/CartContext";
import { formatCAD } from "@/lib/money";

/** Nav cart: a sketch tote icon with an item-count badge. Clicking it opens a
 *  slide-over drawer from the right showing the full cart. */
export default function CartNavButton() {
  const { items, count, ready, removeItem } = useCart();
  const [open, setOpen] = useState(false);
  // The drawer is portaled to <body>: the nav header is `position: fixed` and
  // animates via transform, which would otherwise trap the drawer's own `fixed`
  // positioning inside the (short) header box. mounted gates the portal so it
  // only runs client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client mount gate for the portal
    setMounted(true);
  }, []);

  // Close on Escape, and lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const total = items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  return (
    <>
      <button
        type="button"
        aria-label={`Cart${count ? ` (${count})` : ""}`}
        title="Your cart"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-dream-purple transition-transform hover:-translate-y-0.5 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
      >
        <CartIcon className="h-[22px] w-[22px]" />
        {ready && count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-dream-purple px-1 text-[11px] font-bold leading-none text-white">
            {count}
          </span>
        )}
      </button>

      {/* Slide-over drawer, portaled to <body> so it escapes the fixed/animated
          nav header's containing block. Always mounted so it can transition. */}
      {mounted &&
        createPortal(
          <div
            className={cn("fixed inset-0 z-[60]", open ? "" : "pointer-events-none")}
            aria-hidden={!open}
          >
        {/* Backdrop */}
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-dream-ink/40 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />

        {/* Panel */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Your cart"
          className={cn(
            "absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-[-12px_0_40px_-12px_rgba(27,20,88,0.35)] transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-dream-purple/15 bg-white px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <CartIcon className="h-5 w-5 text-dream-purple" />
              <h2 className="font-display text-base font-bold text-dream-ink">
                Your cart{count > 0 ? ` (${count})` : ""}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close cart"
              className="flex h-9 w-9 items-center justify-center rounded-full text-dream-muted transition-colors hover:bg-dream-lavender-soft hover:text-dream-ink"
            >
              <span aria-hidden="true" className="text-2xl leading-none">&times;</span>
            </button>
          </div>

          {count === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white">
                <CartIcon className="h-8 w-8 text-dream-purple/40" />
              </span>
              <p className="mt-4 font-display text-base font-bold text-dream-ink">Your cart is empty</p>
              <p className="mt-1 text-sm text-dream-muted">Design something and add it here.</p>
              <Link
                href="/shop"
                onClick={() => setOpen(false)}
                className="rough-pill rough-pill-filled mt-5 inline-flex items-center justify-center px-6 py-2.5 font-display text-sm font-bold text-white"
              >
                Browse the shop
              </Link>
            </div>
          ) : (
            <>
              {/* Items, fills the drawer, scrolls if long */}
              <ul className="flex-1 space-y-3 overflow-y-auto p-5">
                {items.map((item) => (
                  <li
                    key={item.designId}
                    className="flex items-stretch gap-3.5 rounded-lg border border-dream-line bg-white p-2.5"
                  >
                    <span className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
                      {item.mockupUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.mockupUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <CartIcon className="h-7 w-7 text-dream-purple/40" />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-display text-sm font-semibold text-dream-ink">{item.productName}</p>
                        <span className="shrink-0 font-display text-base font-bold text-dream-purple">
                          {formatCAD(item.total)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-dream-muted">{item.colourSummary}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.designId)}
                        aria-label={`Remove ${item.productName}`}
                        className="mt-auto self-end pt-2 text-xs font-semibold text-dream-faint transition-colors hover:text-dream-danger"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Footer, estimate + CTA, pinned to the bottom */}
              <div className="border-t border-dream-purple/15 bg-white px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-dream-muted">Estimated</span>
                  <span className="font-display text-xl font-extrabold text-dream-ink">{formatCAD(total)}</span>
                </div>
                <p className="mt-1 text-[11px] text-dream-muted">
                  Estimate only. We confirm pricing before anything prints.
                </p>
                <Link
                  href="/cart"
                  onClick={() => setOpen(false)}
                  className="rough-pill rough-pill-filled mt-3 flex items-center justify-center px-4 py-3 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                >
                  View cart &amp; request
                </Link>
              </div>
            </>
          )}
        </aside>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Hand-drawn tote/cart, a wobbly bag with two handles, matching the nav's
 *  sketched search/close icons. */
function CartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5.4 8.2c4.4-.5 8.9-.5 13.3 0 .5 3.7.8 7.4.9 11.1-5.1.6-10.2.6-15.2 0 .1-3.7.4-7.4 1-11.1Z" />
      <path d="M8.6 8c-.2-2 .6-4.2 2.6-4.7 1.7-.4 3.4.6 4 2.2.3.8.3 1.7.2 2.5" />
    </svg>
  );
}
