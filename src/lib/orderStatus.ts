import type { OrderStatus } from "@/lib/db/rows";

/** Customer-facing tracker stages (PRD §5.4.1) — the Domino's-style dog journey. */
export const TRACKER_STAGES = [
  { key: "received", label: "Order received" },
  { key: "proof", label: "Proof ready" },
  { key: "production", label: "In production" },
  { key: "qc", label: "Quality check" },
  { key: "fulfilment", label: "Shipped / ready" },
  { key: "complete", label: "Complete" },
] as const;

export type TrackerStageKey = (typeof TRACKER_STAGES)[number]["key"];

/** Map an order status to its tracker stage index (or -1 for draft/cancelled). */
export function statusStageIndex(status: OrderStatus): number {
  switch (status) {
    case "submitted":
    case "in_review":
      return 0;
    case "proof_ready":
    case "changes_requested":
      return 1;
    case "approved":
    case "in_production":
      return 2;
    case "quality_check":
      return 3;
    case "shipped":
    case "ready_for_pickup":
      return 4;
    case "completed":
      return 5;
    default:
      return -1; // draft / on_hold / cancelled
  }
}

interface StatusMeta {
  label: string;
  badge: "neutral" | "success" | "warn" | "danger" | "info" | "purple";
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  draft: { label: "Draft", badge: "neutral" },
  submitted: { label: "Order received", badge: "info" },
  in_review: { label: "In review", badge: "info" },
  proof_ready: { label: "Proof ready", badge: "purple" },
  changes_requested: { label: "Changes requested", badge: "warn" },
  approved: { label: "Approved", badge: "success" },
  in_production: { label: "In production", badge: "purple" },
  quality_check: { label: "Quality check", badge: "info" },
  shipped: { label: "Shipped", badge: "success" },
  ready_for_pickup: { label: "Ready for pickup", badge: "success" },
  completed: { label: "Completed", badge: "success" },
  on_hold: { label: "On hold", badge: "warn" },
  cancelled: { label: "Cancelled", badge: "danger" },
};

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_META[status]?.label ?? status;
}
