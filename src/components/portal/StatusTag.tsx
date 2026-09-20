import React from "react";
import { cn } from "@/lib/cn";

export type StatusTone = "neutral" | "success" | "warn" | "danger" | "info" | "purple";

const TONES: Record<StatusTone, string> = {
  neutral: "bg-dream-bg text-dream-muted",
  info: "bg-dream-info-soft text-dream-info",
  purple: "bg-dream-lavender-soft text-dream-purple",
  success: "bg-dream-success-soft text-dream-success",
  warn: "bg-dream-warn-soft text-dream-warn",
  danger: "bg-dream-danger-soft text-dream-danger",
};

/** Squared status tag for the customer portal (never a rounded pill). */
export function StatusTag({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[3px] px-1.5 py-px text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
