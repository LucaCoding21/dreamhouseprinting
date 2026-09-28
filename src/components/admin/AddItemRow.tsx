"use client";

import { cn } from "@/lib/cn";

/**
 * Full-width "+ Add item" bar under an order's line list. The header button
 * sits above the first line, so on a long order this saves scrolling back up
 * after finishing the last one.
 */
export function AddItemRow({
  onClick,
  disabled,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-dream-purple/40 font-display text-sm font-medium text-dream-purple transition-colors",
        "hover:border-dream-purple hover:bg-dream-lavender-mist",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-dream-purple/40 disabled:hover:bg-transparent",
      )}
    >
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Add item
    </button>
  );
}
