/**
 * Shapes + constants shared by the manual-order page, its client form and its
 * server actions. Kept out of actions.ts because a "use server" module may only
 * export async functions.
 */
import type { OrderStatus, ProductColourJson, QuoteDecoration, ProductQuoteCurveJson } from "@/lib/db/rows";
import type { DecorationSpot } from "../actions";

/**
 * Statuses a manually created order may start in. Deliberately excludes
 * proof_ready (nothing to review yet) and the terminal/exception states, which
 * are reached from the order detail page once the order exists.
 */
export const MANUAL_ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "draft", label: "Draft (not started)" },
  { value: "submitted", label: "Order received" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "in_production", label: "In production" },
];

/** Quantity key used by freeform items, which have no size run. */
export const FREEFORM_SIZE = "Qty";

/** A catalog product, slimmed to what the manual-order form needs. */
export interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  /** S&S style number, shown on the line like the order detail does. */
  ssStyleName: string | null;
  isActive: boolean;
  /** Size names in catalog order. */
  sizes: string[];
  /** Full colour rows (hex + per-view blank images) so the line can show the
   *  exact supplier blank, same as the order detail's left rail. */
  colours: ProductColourJson[];
  /** Customer price curve, when the product has one (drives the suggested price). */
  curve: ProductQuoteCurveJson | null;
  /** Curve axes this product actually offers. */
  decorations: QuoteDecoration[];
  /** Decoration methods allowed on this product (id + slug + label). */
  methods: { id: string; name: string; slug: string }[];
}

export interface CustomerHit {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** First saved address, used to prefill the shipping block. */
  address: {
    name?: string;
    company?: string | null;
    phone?: string;
    street?: string;
    city?: string;
    prov?: string;
    postal?: string;
  } | null;
}

export interface ManualOrderItemInput {
  kind: "catalog" | "custom";
  productId: string | null;
  /** Snapshot label: the catalog product name, or the freeform description. */
  productName: string;
  colourName: string | null;
  colourHex: string | null;
  decorationMethodId: string | null;
  /** size -> quantity. Freeform lines use a single "Qty" key. */
  sizeQuantities: Record<string, number>;
  unitPrice: number;
  /** Full print spec, one row per placement, exactly what the order detail edits. */
  spots: DecorationSpot[];
  /** Line finishing, stored in decorations like the detail page does. */
  bagging: boolean;
  sewnTags: boolean;
  /** Where the blanks come from; "" until staff picks one. */
  supplier: string;
  /** Per-line notes, same taxonomy as the order detail. */
  customerNotes: string;
  productionNotes: string;
  shippingNotes: string;
}

export interface ManualOrderAddress {
  name: string;
  company: string;
  phone: string;
  street: string;
  city: string;
  prov: string;
  postal: string;
}

export interface ManualOrderInput {
  /** Existing profile, or null for a guest (walk-in / phone / DM). */
  customerId: string | null;
  guest: { name: string; email: string; phone: string } | null;
  status: OrderStatus;
  fulfillment: "ship" | "pickup";
  /** Rush charge the admin sets directly: a flat dollar amount, or a custom
   *  percentage of the subtotal. Null when no rush is charged. */
  rush: { type: "amount" | "percent"; value: number } | null;
  /** In-hands date (YYYY-MM-DD), optional. */
  dueDate: string | null;
  address: ManualOrderAddress;
  /** Customer-visible note, filed into orders.customer_notes. */
  customerNote: string;
  shipping: number;
  tax: number;
  items: ManualOrderItemInput[];
  sendConfirmation: boolean;
}
