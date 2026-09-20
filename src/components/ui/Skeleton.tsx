import React from "react";
import { cn } from "@/lib/cn";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/** Pulsing placeholder block. Size it with width/height utility classes. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-dream-line", className)}
      {...props}
    />
  );
}

/** A stack of list rows inside a bordered card, mimics table/list pages. */
export function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-dream-line overflow-hidden rounded-xl border border-dream-line bg-dream-surface">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Card with a title line and a few content lines. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-dream-line bg-dream-surface p-4", className)}>
      <Skeleton className="mb-3 h-4 w-1/3" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full last:w-2/3" />
        ))}
      </div>
    </div>
  );
}

/** Portal (customer account) content skeleton: page heading + cards. */
export function PortalPageSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      {children ?? (
        <div className="space-y-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={2} />
        </div>
      )}
    </div>
  );
}
