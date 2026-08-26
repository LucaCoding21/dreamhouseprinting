import React from "react";
import { cn } from "@/lib/cn";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-[14px] font-medium uppercase tracking-wide text-dream-muted",
          className,
        )}
        {...props}
      />
    );
  },
);
Label.displayName = "Label";
