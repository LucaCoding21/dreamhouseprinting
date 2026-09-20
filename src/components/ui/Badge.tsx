import React from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "warn"
  | "danger"
  | "info"
  | "purple";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-dream-bg text-dream-muted border-dream-line",
  success: "bg-dream-success-soft text-dream-success border-transparent",
  warn: "bg-dream-warn-soft text-dream-warn border-transparent",
  danger: "bg-dream-danger-soft text-dream-danger border-transparent",
  info: "bg-dream-info-soft text-dream-info border-transparent",
  purple: "bg-dream-lavender-soft text-dream-purple border-transparent",
};

/** Small status pill. */
export function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[14px] font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
