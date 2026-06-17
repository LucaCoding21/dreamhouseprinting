"use client";

import React, { useId, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Lightweight disclosure used for the product detail "Product details" and
 * "Shipping & turnaround" sections (PRD product page). No dependency — a button
 * toggling a region, matching the reference's collapsible rows.
 */
export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="border-b border-dream-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 py-4 text-left transition-colors hover:text-dream-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
      >
        <span className="font-display text-sm font-semibold text-dream-ink">
          {title}
        </span>
        <PlusMinus open={open} />
      </button>
      {open && (
        <div id={id} className="pb-4 text-sm leading-relaxed text-dream-muted">
          {children}
        </div>
      )}
    </div>
  );
}

function PlusMinus({ open }: { open: boolean }) {
  return (
    <span
      className={cn(
        "relative flex h-5 w-5 shrink-0 items-center justify-center text-dream-faint",
      )}
      aria-hidden="true"
    >
      <span className="absolute h-0.5 w-3 rounded bg-current" />
      <span
        className={cn(
          "absolute h-3 w-0.5 rounded bg-current transition-transform duration-200",
          open && "scale-y-0",
        )}
      />
    </span>
  );
}
