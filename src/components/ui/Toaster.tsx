"use client";

import React from "react";
import { cn } from "@/lib/cn";
import {
  ToastContext,
  useToast,
  useToastState,
  type ToastVariant,
} from "./use-toast";

/** Wrap the app (or a subtree) so `useToast()` and <Toaster /> work. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const value = useToastState();
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "border-dream-line bg-dream-surface text-dream-ink",
  success: "border-dream-success/30 bg-dream-success-soft text-dream-ink",
  error: "border-dream-danger/30 bg-dream-danger-soft text-dream-ink",
};

const ACCENT: Record<ToastVariant, string> = {
  default: "bg-dream-purple",
  success: "bg-dream-success",
  error: "bg-dream-danger",
};

/** Renders queued toasts fixed bottom-right. Included by <ToastProvider>. */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.variant === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-lg border p-3 pl-4 shadow-lg",
            VARIANT_STYLES[t.variant],
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0 left-0 w-1",
              ACCENT[t.variant],
            )}
          />
          <div className="flex-1">
            <p className="text-sm font-medium">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-sm text-dream-muted">
                {t.description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(t.id)}
            className="-mr-1 -mt-1 rounded p-1 text-dream-muted transition-colors hover:text-dream-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
