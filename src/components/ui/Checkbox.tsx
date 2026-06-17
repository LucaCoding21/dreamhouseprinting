"use client";

import React from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Optional label rendered to the right of the box. */
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, disabled, ...props }, ref) => {
    const control = (
      <input
        ref={ref}
        type="checkbox"
        id={id}
        disabled={disabled}
        className={cn(
          "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-dream-line-strong bg-white",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
          "checked:border-dream-purple checked:bg-dream-purple",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );

    if (!label) return control;

    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex items-center gap-2 text-sm text-dream-ink",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <span className="relative inline-flex">
          {control}
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            className="pointer-events-none absolute left-0 top-0 h-4 w-4 text-white opacity-0 peer-checked:opacity-100"
          >
            <path
              d="M3.5 8.5l3 3 6-6.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {label}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
