"use client";

import { useState } from "react";

/**
 * A line's place in the order: a drag grip plus its number, which is editable.
 * Typing a new number moves the line there and shifts the lines in between
 * (4 -> 2 bumps 2 and 3 down to 3 and 4; 4 -> 6 pulls 5 and 6 up to 4 and 5).
 *
 * Only the grip starts a drag (the whole card would break text selection in
 * its inputs). Pressing it hands off to useLineSort, which runs the drag.
 */
export function LinePosition({
  index,
  total,
  onMove,
  onGripPointerDown,
}: {
  index: number;
  total: number;
  /** Omitted = read-only number (no edit permission). */
  onMove?: (to: number) => void;
  onGripPointerDown?: (e: React.PointerEvent) => void;
}) {
  // Only holds text while the field is being edited; otherwise it mirrors index.
  const [draft, setDraft] = useState<string | null>(null);

  if (!onMove) return <span className="shrink-0 text-sm tabular-nums text-dream-faint">{index + 1}.</span>;

  const commit = () => {
    const n = Number.parseInt(draft ?? "", 10);
    setDraft(null);
    if (!Number.isFinite(n)) return;
    const to = Math.min(Math.max(n, 1), total) - 1;
    if (to !== index) onMove(to);
  };

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {onGripPointerDown && total > 1 && (
        // touch-none so a finger on the grip drags the line instead of
        // scrolling the page.
        <span
          role="presentation"
          title="Drag to move this line"
          onPointerDown={onGripPointerDown}
          className="cursor-grab touch-none rounded p-0.5 text-dream-faint transition-colors hover:bg-dream-bg hover:text-dream-ink active:cursor-grabbing max-sm:p-1.5"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden>
            <circle cx="6" cy="4" r="1.2" />
            <circle cx="10" cy="4" r="1.2" />
            <circle cx="6" cy="8" r="1.2" />
            <circle cx="10" cy="8" r="1.2" />
            <circle cx="6" cy="12" r="1.2" />
            <circle cx="10" cy="12" r="1.2" />
          </svg>
        </span>
      )}
      <input
        aria-label={`Line ${index + 1} of ${total}. Type a number to move it`}
        title="Type a number to move this line"
        inputMode="numeric"
        disabled={total < 2}
        value={draft ?? String(index + 1)}
        onFocus={(e) => {
          setDraft(String(index + 1));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(String(index + 1));
            requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
          }
        }}
        className="h-7 w-8 rounded-md border border-transparent bg-transparent text-center text-sm tabular-nums text-dream-faint transition-colors hover:border-dream-line focus:border-dream-purple focus:text-dream-ink focus:outline-none disabled:hover:border-transparent"
      />
    </div>
  );
}
