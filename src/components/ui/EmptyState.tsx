import React from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Optional icon/illustration slot. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional CTA, e.g. a <Button>. */
  action?: React.ReactNode;
}

/** Centered placeholder for empty tables, lists, and panels. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-dream-bg text-dream-muted">
          {icon}
        </div>
      )}
      <h3 className="font-display text-base font-semibold text-dream-ink">
        {title}
      </h3>
      {description && (
        <p className="max-w-sm text-sm text-dream-muted">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
