import type { Database } from "./types";

/** Convenience aliases for table rows, so app code reads `ProductRow` not the deep generic. */
type T = Database["public"]["Tables"];

export type ProfileRow = T["profiles"]["Row"];
export type OrganizationRow = T["organizations"]["Row"];
export type CategoryRow = T["categories"]["Row"];
export type DecorationMethodRow = T["decoration_methods"]["Row"];
export type ProductRow = T["products"]["Row"];
export type PrintAreaRow = T["print_areas"]["Row"];
export type DesignRow = T["designs"]["Row"];
export type OrderRow = T["orders"]["Row"];
export type LineItemRow = T["line_items"]["Row"];
export type ProofRow = T["proofs"]["Row"];
export type OrderActivityRow = T["order_activity"]["Row"];
export type QuoteRow = T["quotes"]["Row"];
export type SettingRow = T["settings"]["Row"];

/** Shapes of the jsonb columns we control (the generated types leave these as Json). */
export interface ProductColourJson {
  name: string;
  hex: string;
  swatch: string | null;
  ssColorCode: string;
  inStock: boolean;
  images: { front: string | null; back: string | null; side: string | null; model: string | null };
}
export interface ProductSizeJson {
  name: string;
  ssSizeCode: string;
  order: string;
  inStock: boolean;
}
export interface ProductPhotoJson {
  src: string;
  type: string;
  colorName?: string;
  view?: string;
}
export interface PrintAreaPositionJson {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The order status set (PRD §2.4) and payment status set (§2.5). */
export const ORDER_STATUSES = [
  "draft", "submitted", "in_review", "proof_ready", "changes_requested",
  "approved", "in_production", "quality_check", "shipped", "ready_for_pickup",
  "completed", "on_hold", "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "unpaid", "deposit_paid", "paid_in_full", "refunded", "partially_refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
