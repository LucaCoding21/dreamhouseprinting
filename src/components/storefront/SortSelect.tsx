"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A–Z" },
];

/** Fixed-position box for the menu, measured from the button. */
type Pos = { right: number; top?: number; bottom?: number; maxH: number };

/**
 * Sort dropdown, updates the ?sort= param, preserving category/search.
 *
 * Deliberately NOT a native <select>: the browser renders that popup wherever
 * it likes (a centered overlay on phones), so the menu never lined up with the
 * control. This is a button + listbox that always opens directly under the
 * button, flipping above it only when there isn't room below.
 *
 * The menu is PORTALED to <body> and positioned `fixed`: the shop hero is
 * `overflow-hidden` (it clips the decorative wave), which would otherwise clip
 * the menu away entirely. A portal is immune to any ancestor's overflow.
 */
export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  // Which option the keyboard/pointer is currently on (not yet chosen).
  const [activeIdx, setActiveIdx] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const selectedIdx = Math.max(
    0,
    OPTIONS.findIndex((o) => o.value === value),
  );
  const current = OPTIONS[selectedIdx];

  function commit(v: string) {
    setOpen(false);
    btnRef.current?.focus();
    const p = new URLSearchParams(params.toString());
    if (v === "featured") p.delete("sort");
    else p.set("sort", v);
    router.push(`/shop?${p.toString()}`, { scroll: false });
  }

  // Measure the button and decide whether the menu hangs below or flips above,
  // so a button near the bottom of the viewport still shows its options.
  const measure = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 240 && above > below;
    setPos({
      right: Math.max(8, window.innerWidth - r.right),
      top: up ? undefined : r.bottom + 8,
      bottom: up ? window.innerHeight - r.top + 8 : undefined,
      maxH: Math.max(160, Math.min(320, up ? above : below)),
    });
  }, []);

  function openMenu() {
    measure();
    setActiveIdx(selectedIdx);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // The panel lives in a portal, so it is NOT inside rootRef; check both
      // or every click on an option would read as "outside" and close first.
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onReflow = () => measure();
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, measure]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % OPTIONS.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + OPTIONS.length) % OPTIONS.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(OPTIONS.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(OPTIONS[activeIdx].value);
    }
  }

  const menu =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label="Sort products"
            style={{
              position: "fixed",
              right: pos.right,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxH,
            }}
            className="z-[60] w-60 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border border-dream-line bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(27,20,88,0.3)]"
          >
            {OPTIONS.map((o, i) => {
              const isSelected = o.value === current.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => commit(o.value)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    i === activeIdx && "bg-dream-lavender-mist",
                    isSelected ? "font-semibold text-dream-purple" : "text-dream-ink",
                  )}
                >
                  <CheckIcon
                    className={cn(
                      "h-4 w-4 shrink-0 text-dream-purple",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative shrink-0" onKeyDown={onKeyDown}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sort products, ${current.label}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={cn(
          "flex h-11 items-center gap-2 rounded-full border bg-white pl-4 pr-3 text-sm font-medium text-dream-ink shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
          open
            ? "border-dream-purple ring-2 ring-dream-purple/25"
            : "border-dream-line hover:border-dream-lavender",
        )}
      >
        <span className="truncate">{current.label}</span>
        <ChevronIcon
          className={cn(
            "h-4 w-4 shrink-0 text-dream-faint transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>
      {menu}
    </div>
  );
}

function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}
