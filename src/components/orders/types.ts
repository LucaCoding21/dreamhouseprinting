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
  pricing: { total?: number; subtotal?: number; setupFees?: number; rush?: number };
  invoice_sent_at: string | null;
  invoice_amount: number | null;
  paid_at: string | null;
}

export interface OrderViewLineItem {
  id: string;
  product_name: string | null;
  colourName: string | null;
  colourHex: string | null;
  sizeQuantities: Record<string, number>;
  line_total: number | null;
  /**
   * The design mockup for THIS colourway — non-null only when this line item is
   * the colour the design was actually mocked up on. Non-designed colourways get
   * null (their thumbnail falls back to a colour swatch).
   */
  mockup: string | null;
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
  activity: OrderViewActivityEntry[];
  actions: OrderViewActions;
}
