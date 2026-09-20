"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Dreamhouse's own need-by calendar. Used on the rush turnaround step: when a
 * customer requests a rush we require them to pick the day they need the order
 * in hand. Renders INLINE, quick shortcuts (Today / Tomorrow / This weekend /
 * Next week) above a month grid, so choosing "Pick a date" simply expands the
 * box it sits in. It used to open a portaled popup, which needed fixed-position
 * measuring and flip logic purely to escape the checkout card's overflow, all of
 * which an inline panel makes unnecessary.
 *
 * Value + onChange speak plain `YYYY-MM-DD` strings (local calendar day, no
 * timezone drift) so the parent can pass it straight through to the order.
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
  className,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = value ? startOfDay(fromISODate(value)) : null;
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date((selected ?? today).getFullYear(), (selected ?? today).getMonth(), 1)
  );

  function pick(d: Date) {
    onChange(toISODate(d));
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  // Quick shortcuts, dates + the short weekday shown alongside.
  const day = today.getDay();
  const tomorrow = addDays(today, 1);
  // Upcoming Saturday (today if it already is Saturday).
  const thisWeekend = addDays(today, (6 - day + 7) % 7);
  // Next Monday (always at least one day out).
  const nextWeek = addDays(today, ((1 - day + 7) % 7) || 7);
  const shortDow = (d: Date) => d.toLocaleDateString("en-CA", { weekday: "short" });

  // One tone for every icon: four different hues read as a rainbow against the
  // lavender/cream palette and were the loudest thing on the panel.
  const shortcuts = [
    { label: "Today", date: today, icon: <SunIcon /> },
    { label: "Tomorrow", date: tomorrow, icon: <SunriseIcon /> },
    { label: "This weekend", date: thisWeekend, icon: <SofaIcon /> },
    { label: "Next week", date: nextWeek, icon: <CalIcon /> },
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
    <div className={cn(className)}>
      {/* Quick shortcuts, a wrap row rather than the popup's vertical list: the
          inline panel is wider than it is tall, so they cost almost no height. */}
      <div className="flex flex-wrap gap-1.5">
        {shortcuts.map((s) => {
          const on = !!selected && sameDay(s.date, selected);
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => pick(s.date)}
              aria-pressed={on}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors",
                on
                  ? "bg-dream-lavender-soft ring-1 ring-inset ring-dream-purple"
                  : "bg-white ring-1 ring-inset ring-dream-line hover:ring-dream-purple/50"
              )}
            >
              <span className="shrink-0 text-dream-purple [&>svg]:h-3.5 [&>svg]:w-3.5">{s.icon}</span>
              <span className="text-[14px] font-semibold text-dream-ink">{s.label}</span>
              <span className="text-[14px] text-dream-faint">{shortDow(s.date)}</span>
            </button>
          );
        })}
      </div>

      {/* Month grid */}
      <div className="mt-3 border-t border-dream-line pt-2">
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => canGoPrev && setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
            disabled={!canGoPrev}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-md text-dream-muted transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-display text-sm font-bold text-dream-ink">
            {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-md text-dream-muted transition-colors hover:bg-white"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-[14px] font-semibold text-dream-faint">
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
                  "mx-auto flex h-8 w-8 items-center justify-center rounded-md text-[14px] transition-colors",
                  isPast && "cursor-not-allowed text-dream-line-strong",
                  !isPast && !isSelected && "text-dream-ink hover:bg-white",
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

      {/* Confirmation of the chosen day, spelled out in full so there is no
          ambiguity about which date a highlighted cell means. */}
      {selected && (
        <p className="mt-2 border-t border-dream-line pt-2 text-[14px] font-semibold text-dream-ink">
          <span className="text-dream-muted">Need it by </span>
          {fmtLong(selected)}
        </p>
      )}
    </div>
  );
}

/*, icons (inline, no deps), */
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
