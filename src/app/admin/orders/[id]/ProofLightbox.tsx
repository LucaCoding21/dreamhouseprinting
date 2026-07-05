"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { cn } from "@/lib/cn";

/** Fullscreen viewer for a proof — image or PDF — so staff can double-check the
 *  real artwork at full size before (or after) it goes to the customer. */
export function ProofLightbox({
  src,
  kind,
  title,
  open,
  onOpenChange,
}: {
  src: string;
  kind: "image" | "pdf";
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-dream-ink/90 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3 text-white">
        <span className="truncate text-sm font-medium">{title ?? "Proof preview"}</span>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close fullscreen"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium transition-colors hover:bg-white/20"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-4 w-4" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
          Close
        </button>
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        {kind === "pdf" ? (
          <iframe src={src} title={title ?? "Proof PDF"} className="h-full w-full rounded-lg bg-white" />
        ) : (
          <Image
            src={src}
            alt={title ?? "Proof"}
            width={1600}
            height={1600}
            unoptimized
            className={cn("max-h-full max-w-full object-contain")}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Trigger the lightbox off any proof src; renders its own button + overlay state. */
export function fileKind(nameOrType: string): "image" | "pdf" {
  return /pdf/i.test(nameOrType) ? "pdf" : "image";
}
