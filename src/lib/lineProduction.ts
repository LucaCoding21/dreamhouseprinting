/**
 * Per-line-item production status, tracks each garment's progress through the
 * shop independently of the order status and of the other lines. Different items
 * in one order can legitimately be at different stages (e.g. one shirt printed,
 * another still queued). Stored on line_items.decorations.productionStatus.
 */
export const LINE_PRODUCTION_STATUSES = [
  "not_started",
  "in_production",
  "quality_check",
  "complete",
] as const;

export type LineProductionStatus = (typeof LINE_PRODUCTION_STATUSES)[number];

export const LINE_PRODUCTION_META: Record<
  LineProductionStatus,
  { label: string; badge: "neutral" | "info" | "warn" | "success" }
> = {
  not_started: { label: "Not started", badge: "neutral" },
  in_production: { label: "In production", badge: "info" },
  quality_check: { label: "Quality check", badge: "warn" },
  complete: { label: "Complete", badge: "success" },
};

export const DEFAULT_LINE_PRODUCTION_STATUS: LineProductionStatus = "not_started";
