"use client";

import React from "react";
import { cn } from "@/lib/cn";

/**
 * Small "?" badge that reveals a plain-language explanation on hover or focus.
 * Used next to admin field labels so Julian can learn what a setting does
 * without leaving the page.
 */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("group relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label={text}
        tabIndex={0}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-dream-line bg-dream-bg text-[10px] font-bold leading-none text-dream-muted transition-colors hover:border-dream-purple hover:text-dream-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-60 -translate-x-1/2 rounded-lg bg-dream-ink px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
