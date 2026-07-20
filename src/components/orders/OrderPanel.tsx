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
}: {
  title: React.ReactNode;
  /** Small status tag rendered next to the title. */
  tag?: React.ReactNode;
  /** Right-aligned header slot (icon button, link, etc.). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-dream-line bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-dream-line px-5 py-4">
        <h2 className="font-display text-lg font-bold text-dream-ink">{title}</h2>
        {tag}
        {action && <div className="ml-auto flex items-center">{action}</div>}
      </div>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
