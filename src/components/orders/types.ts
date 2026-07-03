import type { OrderStatus } from "@/lib/db/rows";

/**
 * Serialized props for the shared <OrderView>, rendered by BOTH the logged-in
 * portal (/account/orders/[id]) and the public tokenized page (/o/[token]).
 * Plain data only — no Supabase rows or server-only imports — so the client
 * children (ProofPanel, InvoicePanel) can share these types.
 */

export interface OrderViewOrder {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  due_date: string | null;
  pricing: { total?: number; subtotal?: number; setupFees?: number };
  invoice_sent_at: string | null;
  invoice_amount: number | null;
  paid_at: string | null;
}

export interface OrderViewLineItem {
  id: string;
  product_name: string | null;
  colourName: string | null;
  sizeQuantities: Record<string, number>;
  line_total: number | null;
}

export interface OrderViewProof {
  id: string;
  image: string;
  status: string;
  change_request_comment: string | null;
}

/** One merged, customer-visible timeline entry (activity row or customer note). */
export interface OrderViewActivityEntry {
  /** ISO timestamp. */
  at: string;
  text: string;
}

/**
 * Server-action references, bound to the current order/token by each route and
 * passed down to the client children. Every function is a plain async server
 * action from a "use server" file.
 */
export interface OrderViewActions {
  approveProof: (proofId: string) => Promise<{ ok?: boolean; error?: string }>;
  requestChanges: (proofId: string, comment: string) => Promise<{ ok?: boolean; error?: string }>;
  payNow: () => Promise<{ url?: string; error?: string }>;
}

export interface OrderViewProps {
  order: OrderViewOrder;
  lineItems: OrderViewLineItem[];
  proofs: OrderViewProof[];
  /** First available mockup image, used as the line-item thumbnail. */
  firstMockup: string | null;
  activity: OrderViewActivityEntry[];
  actions: OrderViewActions;
}
