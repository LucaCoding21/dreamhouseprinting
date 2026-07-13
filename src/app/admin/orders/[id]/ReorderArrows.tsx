"use client";

/** Up/down controls to move a line within the order's queue. */
export function ReorderArrows({
  onUp,
  onDown,
  disableUp,
  disableDown,
}: {
  onUp: () => void;
  onDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        onClick={onUp}
        disabled={disableUp}
        aria-label="Move line up"
        title="Move up"
        className="rounded p-0.5 text-dream-faint transition-colors hover:bg-dream-bg hover:text-dream-ink disabled:pointer-events-none disabled:opacity-30"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
          <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disableDown}
        aria-label="Move line down"
        title="Move down"
        className="rounded p-0.5 text-dream-faint transition-colors hover:bg-dream-bg hover:text-dream-ink disabled:pointer-events-none disabled:opacity-30"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
