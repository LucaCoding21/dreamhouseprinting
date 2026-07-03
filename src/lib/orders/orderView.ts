import "server-only";

import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/rows";
import type { OrderRow, LineItemRow, DesignRow, ProofRow, OrderActivityRow } from "@/lib/db/rows";
import type {
  OrderViewOrder,
  OrderViewLineItem,
  OrderViewProof,
  OrderViewActivityEntry,
} from "@/components/orders/types";

/**
 * Turn the raw order/line-item/design/proof/activity rows into the plain,
 * serialized props the shared <OrderView> renders. Both routes load their rows
 * differently (portal via RLS, public via the service client) but funnel
 * through here so the customer-facing shape is identical.
 */

/** Activity types the customer is allowed to see in their timeline. */
const CUSTOMER_ACTIVITY_TYPES = new Set([
  "status_change",
  "proof_uploaded",
  "proof_approved",
  "changes_requested",
  "invoice_sent",
  "payment_received",
]);

function activityText(type: string, detail: Record<string, unknown>): string {
  switch (type) {
    case "status_change": {
      const to = typeof detail.to === "string" ? detail.to : "";
      const label = STATUS_META[to as OrderStatus]?.label ?? to.replace(/_/g, " ");
      return `Status updated to ${label}`;
    }
    case "proof_uploaded":
      return "A new proof was uploaded for your review";
    case "proof_approved":
      return "You approved the proof";
    case "changes_requested": {
      const comment = typeof detail.comment === "string" ? detail.comment : "";
      return comment ? `You requested changes: “${comment}”` : "You requested changes to the proof";
    }
    case "invoice_sent":
      return "Your invoice was sent";
    case "payment_received":
      return "Payment received — thank you!";
    default:
      return type.replace(/_/g, " ");
  }
}

function buildActivity(order: OrderRow, activity: OrderActivityRow[]): OrderViewActivityEntry[] {
  const entries: OrderViewActivityEntry[] = [];

  for (const a of activity) {
    if (!CUSTOMER_ACTIVITY_TYPES.has(a.type)) continue;
    const detail = (a.detail ?? {}) as Record<string, unknown>;
    entries.push({ at: a.created_at, text: activityText(a.type, detail) });
  }

  const notes = (order.customer_notes ?? []) as { at?: string; actor?: string; text?: string }[];
  for (const n of notes) {
    if (!n.text) continue;
    entries.push({ at: n.at ?? order.created_at, text: n.text });
  }

  // Newest first.
  return entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export interface OrderViewInput {
  order: OrderRow;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  proofs: ProofRow[];
  activity: OrderActivityRow[];
}

export interface OrderViewSerialized {
  order: OrderViewOrder;
  lineItems: OrderViewLineItem[];
  proofs: OrderViewProof[];
  firstMockup: string | null;
  activity: OrderViewActivityEntry[];
}

export function serializeOrderView(input: OrderViewInput): OrderViewSerialized {
  const { order, lineItems, designs, proofs, activity } = input;

  const firstMockup =
    designs
      .flatMap((d) => (d.mockup_images ?? []) as { view: string; url: string | null }[])
      .find((m) => m.url)?.url ?? null;

  return {
    order: {
      id: order.id,
      order_number: order.order_number,
      status: order.status as OrderStatus,
      due_date: order.due_date,
      pricing: (order.pricing ?? {}) as { total?: number; subtotal?: number; setupFees?: number },
      invoice_sent_at: order.invoice_sent_at,
      invoice_amount: order.invoice_amount,
      paid_at: order.paid_at,
    },
    lineItems: lineItems.map((li) => ({
      id: li.id,
      product_name: li.product_name,
      colourName: ((li.colour ?? {}) as { name?: string }).name ?? null,
      sizeQuantities: (li.size_quantities ?? {}) as Record<string, number>,
      line_total: li.line_total,
    })),
    proofs: proofs.map((p) => ({
      id: p.id,
      image: p.image,
      status: p.status,
      change_request_comment: p.change_request_comment,
    })),
    firstMockup,
    activity: buildActivity(order, activity),
  };
}
