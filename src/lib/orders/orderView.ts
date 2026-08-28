import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUS_META, statusStageIndex, TRACKER_STAGES } from "@/lib/orderStatus";
import { mergePaymentSettings, etransferOption } from "@/lib/paymentSettings";
import { normalizeAdjustments } from "@/lib/orders/pricingMath";
import type { OrderStatus } from "@/lib/db/rows";
import type { OrderRow, LineItemRow, DesignRow, ProofRow, OrderActivityRow } from "@/lib/db/rows";
import type { Database } from "@/lib/db/types";
import type {
  OrderViewOrder,
  OrderViewLineItem,
  OrderViewProof,
  OrderViewActivityEntry,
  OrderViewMessage,
  OrderViewEtransfer,
} from "@/components/orders/types";

/**
 * Resolve the customer-facing Interac e-Transfer option for an order page, or
 * null when it must not be offered. Deliberately defensive so both order pages
 * render on an unmigrated database:
 *
 * e-Transfer needs migration 0015's `orders.payment_method` /
 * `orders.etransfer_reported_at` columns to record a report or a payment. If
 * those columns are absent (0015 not applied), selecting one errors, so we
 * probe first and treat e-transfer as DISABLED (card-only) rather than offering
 * a path whose "I've sent it" / mark-paid writes would fail at runtime. Any
 * failure reading the columns or the `payments` settings row degrades to null.
 * Never throws.
 */
export async function resolveEtransferOption(
  service: SupabaseClient<Database>,
): Promise<OrderViewEtransfer | null> {
  try {
    const probe = await service.from("orders").select("etransfer_reported_at").limit(1);
    if (probe.error) return null; // 0015 columns missing, offer card only.
    const { data, error } = await service.from("settings").select("value").eq("key", "payments").maybeSingle();
    if (error) return null;
    return etransferOption(mergePaymentSettings(data?.value));
  } catch {
    return null;
  }
}

/**
 * Turn the raw order/line-item/design/proof/activity rows into the plain,
 * serialized props the shared <OrderView> renders. Both routes load their rows
 * differently (portal via RLS, public via the service client) but funnel
 * through here so the customer-facing shape is identical.
 */

/** Activity types the customer is allowed to see in their timeline.
 *  proof_uploaded is deliberately absent: uploads are internal drafts now, the
 *  customer hears about proofs when the order is sent for approval
 *  (status_change to proof_ready). */
const CUSTOMER_ACTIVITY_TYPES = new Set([
  "status_change",
  "proof_approved",
  "changes_requested",
  "invoice_sent",
  "payment_received",
  "etransfer_reported",
]);

function activityText(type: string, detail: Record<string, unknown>): string {
  switch (type) {
    case "status_change": {
      const to = typeof detail.to === "string" ? detail.to : "";
      const label = STATUS_META[to as OrderStatus]?.label ?? to.replace(/_/g, " ");
      return `Status updated to ${label}`;
    }
    case "proof_approved":
      return "You approved the proof";
    case "changes_requested": {
      const comment = typeof detail.comment === "string" ? detail.comment : "";
      return comment ? `You requested changes: “${comment}”` : "You requested changes to the proof";
    }
    case "invoice_sent":
      return "Your invoice was sent";
    case "payment_received":
      return "Payment received. Thank you!";
    case "etransfer_reported":
      return "You let us know your e-transfer is on the way";
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

/**
 * Best-effort date the order entered each tracker stage, index-aligned to
 * TRACKER_STAGES. Stage 0 defaults to order creation; every `status_change`
 * activity maps its target status to a stage and records the earliest entry.
 */
function buildStageDates(order: OrderRow, activity: OrderActivityRow[]): (string | null)[] {
  const dates: (string | null)[] = TRACKER_STAGES.map(() => null);
  const setEarliest = (idx: number, at: string | null | undefined) => {
    if (idx < 0 || idx >= dates.length || !at) return;
    if (!dates[idx] || at < dates[idx]!) dates[idx] = at;
  };

  setEarliest(0, order.created_at); // submitted == stage 0
  for (const a of activity) {
    if (a.type !== "status_change") continue;
    const to = ((a.detail ?? {}) as Record<string, unknown>).to;
    if (typeof to !== "string") continue;
    setEarliest(statusStageIndex(to as OrderStatus), a.created_at);
  }
  return dates;
}

/** The most recent message Julian sent the customer (from customer_notes). */
function latestMessage(order: OrderRow): OrderViewMessage | null {
  const notes = (order.customer_notes ?? []) as { at?: string; actor?: string; text?: string }[];
  let latest: OrderViewMessage | null = null;
  for (const n of notes) {
    if (!n.text) continue;
    const at = n.at ?? order.created_at;
    if (!latest || at > latest.at) latest = { at, text: n.text, actor: n.actor ?? null };
  }
  return latest;
}

/**
 * Pull the customer-facing note out of an `orders.production_notes` blob.
 *
 * ONLY the `customer` key is ever read here. `inventory` and `printer` are
 * internal staff fields and must never be serialized to a customer, so nothing
 * else in this module touches them.
 */
export function customerNoteFrom(raw: unknown): string | null {
  const note = ((raw ?? {}) as { customer?: unknown }).customer;
  if (typeof note !== "string") return null;
  return note.trim() || null;
}

export interface OrderViewInput {
  order: OrderRow;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  proofs: ProofRow[];
  activity: OrderActivityRow[];
  /**
   * The customer-visible production note, when the caller had to read it
   * separately. The portal loads orders with the authenticated role, which is
   * not granted the staff-only `production_notes` column (migration 0014), so
   * it fetches the note with the service client and passes it in here. The
   * public /o route selects the whole row, so it can leave this undefined and
   * let the row supply it.
   */
  customerNote?: string | null;
}

export interface OrderViewSerialized {
  order: OrderViewOrder;
  lineItems: OrderViewLineItem[];
  proofs: OrderViewProof[];
  activity: OrderViewActivityEntry[];
  /** ISO date the order entered each tracker stage; null where unknown. */
  stageDates: (string | null)[];
  /** Newest direct message from Julian, surfaced as a banner. */
  latestMessage: OrderViewMessage | null;
}

/** The design's first mockup URL, front view preferred when the view is identifiable. */
export function designMockup(design: DesignRow): string | null {
  const mockups = (design.mockup_images ?? []) as { view?: string; url?: string | null }[];
  const front = mockups.find((m) => m.url && /front/i.test(m.view ?? ""));
  return front?.url ?? mockups.find((m) => m.url)?.url ?? null;
}

const normColour = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function serializeOrderView(input: OrderViewInput): OrderViewSerialized {
  const { order, lineItems, designs, proofs, activity } = input;
  // The customer sees their note exactly as THEY submitted it: the immutable
  // copy in the design's price snapshot. The admin's per-line
  // decorations.customerNotes is an editable INTERNAL record prefilled from the
  // same note, deliberately never serialized here, so tidying it can't push
  // words into the customer's mouth. Legacy orders stored one note at
  // orders.production_notes.customer; fall back there so old orders keep it.
  const submittedNotes = [
    ...new Set(
      designs
        .map((d) => ((((d.price_snapshot ?? {}) as { customerNote?: unknown }).customerNote as string) ?? "").toString().trim())
        .filter(Boolean),
    ),
  ];
  const legacyNote =
    input.customerNote !== undefined
      ? (input.customerNote?.trim() || null)
      : customerNoteFrom(order.production_notes);
  const customerNote = submittedNotes.length > 0 ? submittedNotes.join("\n\n") : legacyNote;

  const designsById = new Map(designs.map((d) => [d.id, d]));
  // Tracks which design_ids have already had their designed line item resolved,
  // so the fallback (design.colour missing) can pin the mockup to the FIRST line
  // item for that design, placeOrderAction inserts colourways in order, the
  // designed colour first.
  const fallbackClaimed = new Set<string>();

  function lineMockup(designId: string | null, colourName: string | null): string | null {
    if (!designId) return null;
    const design = designsById.get(designId);
    if (!design) return null;
    const mockup = designMockup(design);
    if (!mockup) return null;

    const designedColour = ((design.colour ?? {}) as { name?: string }).name;
    if (designedColour) {
      // Robust: only the colourway the design was actually mocked up on gets the art.
      return normColour(designedColour) === normColour(colourName) ? mockup : null;
    }

    // Fallback: no designed colour recorded, treat the first line item for this
    // design as the designed one.
    if (fallbackClaimed.has(designId)) return null;
    fallbackClaimed.add(designId);
    return mockup;
  }

  // Pending proofs are drafts until the admin sends the order for approval
  // (status proof_ready). Decided proofs (approved / changes requested) stay
  // visible as history regardless of where the order has moved since. Resolved
  // once, so the line-item proofs and the proof list can never disagree about
  // what the customer may see.
  const visibleProofs = proofs.filter((p) => p.status !== "pending" || order.status === "proof_ready");

  // Newest visible proof per line. Both callers load proofs newest-first, so
  // the first hit wins.
  const proofByLine = new Map<string, ProofRow>();
  for (const p of visibleProofs) {
    if (p.line_item_id && !proofByLine.has(p.line_item_id)) proofByLine.set(p.line_item_id, p);
  }

  return {
    order: {
      id: order.id,
      order_number: order.order_number,
      status: order.status as OrderStatus,
      due_date: order.due_date,
      pricing: {
        ...((order.pricing ?? {}) as OrderViewOrder["pricing"]),
        // Normalized so a hand-edited jsonb row can't break the summary rows.
        adjustments: normalizeAdjustments(((order.pricing ?? {}) as { adjustments?: unknown }).adjustments),
      },
      customerNote,
      invoice_sent_at: order.invoice_sent_at,
      invoice_amount: order.invoice_amount,
      paid_at: order.paid_at,
      payment_method: order.payment_method,
      etransfer_reported_at: order.etransfer_reported_at,
    },
    lineItems: lineItems.map((li) => {
      const colour = (li.colour ?? {}) as { name?: string; hex?: string };
      const proof = proofByLine.get(li.id) ?? null;
      return {
        id: li.id,
        product_name: li.product_name,
        colourName: colour.name ?? null,
        colourHex: colour.hex ?? null,
        sizeQuantities: (li.size_quantities ?? {}) as Record<string, number>,
        line_total: li.line_total,
        mockup: lineMockup(li.design_id, colour.name ?? null),
        proof: proof ? { id: proof.id, image: proof.image, status: proof.status } : null,
      };
    }),
    proofs: visibleProofs.map((p) => ({
      id: p.id,
      image: p.image,
      status: p.status,
      change_request_comment: p.change_request_comment,
      lineItemId: p.line_item_id,
    })),
    activity: buildActivity(order, activity),
    stageDates: buildStageDates(order, activity),
    latestMessage: latestMessage(order),
  };
}
