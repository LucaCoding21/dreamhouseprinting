"use client";

import React from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "children"
  > {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** A controlled toggle switch (role="switch"). Purple track when on. */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-dream-purple" : "bg-dream-line-strong",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";
