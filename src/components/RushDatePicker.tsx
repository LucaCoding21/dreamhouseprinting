"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Dreamhouse's own need-by calendar. Used on the rush turnaround step: when a
 * customer requests a rush we require them to pick the day they need the order
 * in hand. Renders an input-style trigger that opens a floating panel with
 * quick shortcuts (Today / Tomorrow / This weekend / Next week) above a month
 * grid. Value + onChange speak plain `YYYY-MM-DD` strings (local calendar day,
 * no timezone drift) so the parent can pass it straight through to the order.
 */

/** Local-day ISO string (YYYY-MM-DD), deliberately NOT toISOString(), which shifts to UTC. */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Strip time so day-to-day comparisons are exact. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtLong(d: Date): string {
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function RushDatePicker({
  value,
  onChange,
  autoOpen = false,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  /** Open the panel immediately on mount (used when the rush option is picked). */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Fixed-position coords for the portaled panel, so it escapes any
  // overflow-hidden ancestor (the checkout/cart card was clipping it). Null
  // until the client layout effect measures the trigger, which also keeps the
  // portal off the server render (no document.body there).
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = value ? startOfDay(fromISODate(value)) : null;
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date((selected ?? today).getFullYear(), (selected ?? today).getMonth(), 1)
  );

  const PANEL_W = 224; // w-56
  const PANEL_H = 320; // approx, enough to decide flip

  // Position the panel relative to the trigger, flipping above when there's no
  // room below. Recomputed on open, scroll and resize.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const openUp = r.bottom + PANEL_H > window.innerHeight && r.top - PANEL_H > 0;
      const top = openUp ? r.top - PANEL_H - 6 : r.bottom + 6;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8));
      setCoords({ top, left });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Close on outside click / Escape (accounting for the portaled panel).
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(d: Date) {
    onChange(toISODate(d));
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setOpen(false);
  }

  // Quick shortcuts, dates + the short weekday shown on the right.
  const day = today.getDay();
  const tomorrow = addDays(today, 1);
  // Upcoming Saturday (today if it already is Saturday).
  const thisWeekend = addDays(today, (6 - day + 7) % 7);
  // Next Monday (always at least one day out).
  const nextWeek = addDays(today, ((1 - day + 7) % 7) || 7);
  const shortDow = (d: Date) => d.toLocaleDateString("en-CA", { weekday: "short" });

  const shortcuts = [
    { label: "Today", date: today, icon: <SunIcon />, tone: "text-dream-success" },
    { label: "Tomorrow", date: tomorrow, icon: <SunriseIcon />, tone: "text-amber-500" },
    { label: "This weekend", date: thisWeekend, icon: <SofaIcon />, tone: "text-blue-500" },
    { label: "Next week", date: nextWeek, icon: <CalIcon />, tone: "text-dream-purple" },
  ];

  // Build the month grid (leading blanks + days).
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const leading = first.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  const canGoPrev = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1) > new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex w-full max-w-[16rem] items-center gap-2 rounded-lg border bg-white px-2.5 py-2 text-left transition-colors",
          value ? "border-dream-purple" : "border-dream-line-strong hover:border-dream-purple"
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-dream-lavender-soft text-dream-purple">
          <CalIcon />
        </span>
        <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", value ? "text-dream-ink" : "text-dream-faint")}>
          {selected ? fmtLong(selected) : "Pick a date"}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-dream-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && coords && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Pick your need-by date"
          style={{ position: "fixed", top: coords.top, left: coords.left, width: PANEL_W }}
          className="z-[60] overflow-hidden rounded-xl border border-dream-line bg-white shadow-[0_10px_32px_-8px_rgba(27,20,88,0.28)]"
        >
          {/* Quick shortcuts */}
          <div className="border-b border-dream-line">
            {shortcuts.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => pick(s.date)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-dream-lavender-soft"
              >
                <span className={cn("shrink-0", s.tone)}>{s.icon}</span>
                <span className="flex-1 text-[13px] font-medium text-dream-ink">{s.label}</span>
                <span className="text-xs text-dream-faint">{shortDow(s.date)}</span>
              </button>
            ))}
          </div>

          {/* Month grid */}
          <div className="p-2">
            <div className="flex items-center justify-between pb-1">
              <button
                type="button"
                onClick={() => canGoPrev && setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                disabled={!canGoPrev}
                aria-label="Previous month"
                className="flex h-6 w-6 items-center justify-center rounded-md text-dream-muted transition-colors hover:bg-dream-bg disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="font-display text-[13px] font-bold text-dream-ink">
                {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                aria-label="Next month"
                className="flex h-6 w-6 items-center justify-center rounded-md text-dream-muted transition-colors hover:bg-dream-bg"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <div key={w} className="pb-0.5 text-center text-[10px] font-semibold text-dream-faint">
                  {w}
                </div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={`b${i}`} />;
                const isPast = d < today;
                const isToday = sameDay(d, today);
                const isSelected = selected && sameDay(d, selected);
                return (
                  <button
                    key={toISODate(d)}
                    type="button"
                    disabled={isPast}
                    onClick={() => pick(d)}
                    aria-pressed={!!isSelected}
                    className={cn(
                      "mx-auto flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors",
                      isPast && "cursor-not-allowed text-dream-faint/50",
                      !isPast && !isSelected && "text-dream-ink hover:bg-dream-lavender-soft",
                      isSelected && "bg-dream-purple font-bold text-white",
                      !isSelected && isToday && "font-bold text-dream-purple ring-1 ring-inset ring-dream-purple/40"
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/*, icons (inline, no deps), */
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-[18px] w-[18px]",
  "aria-hidden": true,
};
function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}
function SunriseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3v5M8 6l4-3 4 3M3 18h18M5 21h14M8.5 14a3.5 3.5 0 017 0" />
    </svg>
  );
}
function SofaIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 11V8a2 2 0 012-2h12a2 2 0 012 2v3" />
      <path d="M2 13a2 2 0 012-2 2 2 0 012 2v3h12v-3a2 2 0 014 0v5H2z" />
      <path d="M6 18v2M18 18v2" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}
