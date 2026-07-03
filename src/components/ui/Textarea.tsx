import React from "react";
import { cn } from "@/lib/cn";

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, "aria-invalid": ariaInvalid, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={ariaInvalid}
        className={cn(
          "w-full rounded-lg border border-dream-line bg-white px-3 py-2 text-sm text-dream-ink",
          "placeholder:text-dream-faint resize-y",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40 focus-visible:border-dream-purple",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "aria-[invalid=true]:border-dream-danger aria-[invalid=true]:focus-visible:ring-dream-danger/30",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
