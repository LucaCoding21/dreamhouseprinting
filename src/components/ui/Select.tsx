import React from "react";
import { cn } from "@/lib/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** Styled native <select>, wrapped to overlay a chevron icon. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, children, "aria-invalid": ariaInvalid, ...props },
    ref,
  ) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={ariaInvalid}
          className={cn(
                      // text-base below sm is deliberate: iOS Safari auto-zooms the page
          // whenever a focused field is under 16px, which left the portal
          // zoomed in and horizontally scrolled after every tap. 16px on
          // phones stops that; sm+ keeps the original 14px.
          "w-full appearance-none rounded-lg border border-dream-line bg-white pl-3 pr-9 py-2 text-base text-dream-ink sm:text-sm",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40 focus-visible:border-dream-purple",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "aria-[invalid=true]:border-dream-danger aria-[invalid=true]:focus-visible:ring-dream-danger/30",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dream-muted"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  },
);
Select.displayName = "Select";
