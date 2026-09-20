import React from "react";
import { cn } from "@/lib/cn";

/**
 * Warm, brand-styled card shared across the whole customer order view, proof,
 * payment, items, summary, history. Deliberately NOT the admin `ui/Card`
 * primitive (that one stays clean for the admin); this carries the storefront's
 * hard-offset shadow + Archivo heading so the customer surface has personality.
 */
export function OrderPanel({
  title,
  tag,
  action,
  children,
  className,
  bodyClassName,
  collapsible,
  defaultOpen = true,
}: {
  title: React.ReactNode;
  /** Small status tag rendered next to the title. */
  tag?: React.ReactNode;
  /** Right-aligned header slot (icon button, link, etc.). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Fold the body behind its header. Plain <details>, no client JS. */
  collapsible?: boolean;
  /** Only read when `collapsible`. */
  defaultOpen?: boolean;
}) {
  const shell = cn("rounded-3xl border border-dream-line bg-white shadow-sm", className);
  const header = (
    <>
      <h2 className="min-w-0 font-display text-lg font-bold text-dream-ink">{title}</h2>
      {tag && <span className="shrink-0">{tag}</span>}
      {action && <div className="ml-auto flex items-center">{action}</div>}
    </>
  );
  const body = <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>;

  // Collapsible panels are a <details>: the browser owns the open state, so
  // this stays a server component and works before any JS loads.
  if (collapsible) {
    return (
      <section className={shell}>
        <details open={defaultOpen} className="group">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-transparent px-4 py-3.5 sm:px-5 sm:py-4 transition-colors hover:bg-dream-cream/40 group-open:border-dream-line [&::-webkit-details-marker]:hidden">
            {header}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className={cn(
                "h-4 w-4 shrink-0 text-dream-muted transition-transform group-open:rotate-180",
                action ? "" : "ml-auto",
              )}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          {body}
        </details>
      </section>
    );
  }

  return (
    <section className={shell}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-dream-line px-4 py-3.5 sm:px-5 sm:py-4">{header}</div>
      {body}
    </section>
  );
}
