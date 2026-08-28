import type { OrderStatus } from "@/lib/db/rows";

/**
 * Serialized props for the shared <OrderView>, rendered by BOTH the logged-in
 * portal (/account/orders/[id]) and the public tokenized page (/o/[token]).
 * Plain data only, no Supabase rows or server-only imports, so the client
 * children (ProofPanel, InvoicePanel) can share these types.
 */

export interface OrderViewOrder {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  due_date: string | null;
  pricing: {
    total?: number;
    subtotal?: number;
    setupFees?: number;
    rush?: number;
    addons?: number;
    shipping?: number;
    tax?: number;
    discount?: number;
    discountLabel?: string;
    /** Named discounts (negative) and fees (positive) added by admin. */
    adjustments?: { id: string; label: string; amount: number }[];
  };
  /**
   * The note the customer left with their design, mirrored into the order's
   * `production_notes.customer` and editable by staff. This is the ONLY
   * production-note key that ever reaches the client, the inventory / printer
   * keys are internal and stay on the server (see serializeOrderView).
   */
  customerNote: string | null;
  invoice_sent_at: string | null;
  invoice_amount: number | null;
  paid_at: string | null;
  /** 'card' | 'etransfer' | 'other' once a payment path was chosen/settled. */
  payment_method: string | null;
  /** Customer clicked "I've sent the e-transfer"; unpaid until admin confirms. */
  etransfer_reported_at: string | null;
}

/** Interac e-Transfer details for the payment dialog (null = option not offered). */
export interface OrderViewEtransfer {
  email: string;
  note: string | null;
}

export interface OrderViewLineItem {
  id: string;
  product_name: string | null;
  colourName: string | null;
  colourHex: string | null;
  sizeQuantities: Record<string, number>;
  line_total: number | null;
  /**
   * The design mockup for THIS colourway, non-null only when this line item is
   * the colour the design was actually mocked up on. Non-designed colourways get
   * null (their thumbnail falls back to a colour swatch).
   */
  mockup: string | null;
  /**
   * The newest customer-visible proof filed against THIS line, so the approved
   * artwork lives with the garment it belongs to (that is where the customer
   * looks for it, and it survives the proof panel disappearing after approval).
   * Same visibility rule as the `proofs` list: a pending proof only counts once
   * the order is out for approval.
   */
  proof: { id: string; image: string; status: string } | null;
}

export interface OrderViewProof {
  id: string;
  image: string;
  status: string;
  change_request_comment: string | null;
  /** The line item this proof is for; null for a legacy order-level upload. */
  lineItemId: string | null;
}

/** One merged, customer-visible timeline entry (activity row or customer note). */
export interface OrderViewActivityEntry {
  /** ISO timestamp. */
  at: string;
  text: string;
}

/** A direct message Julian sent the customer (newest customer note). */
export interface OrderViewMessage {
  /** ISO timestamp. */
  at: string;
  text: string;
  /** Who sent it (staff name), if recorded. */
  actor: string | null;
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
  /** "I've sent the e-transfer": flags the order for admin verification. */
  reportEtransfer: () => Promise<{ ok?: boolean; error?: string }>;
}

export interface OrderViewProps {
  order: OrderViewOrder;
  lineItems: OrderViewLineItem[];
  proofs: OrderViewProof[];
  activity: OrderViewActivityEntry[];
  /** ISO date the order entered each tracker stage (index-aligned to TRACKER_STAGES); null where unknown. */
  stageDates: (string | null)[];
  actions: OrderViewActions;
  /** E-transfer payment option from admin settings; null hides it (card only). */
  etransfer: OrderViewEtransfer | null;
}
