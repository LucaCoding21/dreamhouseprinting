"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, getProfile, hasPermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { sendOrderStatusEmail, sendOrderEmail, sendOrderCommentEmail } from "@/lib/notify";
import { ensureCheckoutSession } from "@/lib/orders/payments";
import type { Json, Database } from "@/lib/db/types";
import type { OrderStatus, PaymentStatus, ProductionNotesJson } from "@/lib/db/rows";
import type { LineProductionStatus } from "@/lib/lineProduction";
import { mergeAddonSettings, lineAddonTotal } from "@/lib/addonSettings";
import { resolveDiscount, type DiscountType } from "@/lib/pricing/discount";

type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];
const asJson = (v: unknown) => v as unknown as Json;
const YEAR = 60 * 60 * 24 * 365;

async function logActivity(
  service: ReturnType<typeof requireSupabaseServiceClient>,
  orderId: string,
  type: string,
  detail: Record<string, unknown>
) {
  const profile = await getProfile();
  await service.from("order_activity").insert({
    order_id: orderId,
    actor_id: profile?.id ?? null,
    actor_name: profile?.name ?? "Staff",
    type,
    detail: asJson(detail),
  });
}

function revalidateOrder(id: string) {
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/account/orders/${id}`);
  revalidatePath("/account/orders");
  revalidatePath("/account");
}

/** Apply a status transition: update, clear stale hold note, log, email. Returns an error string or null. */
async function applyStatus(
  service: ReturnType<typeof requireSupabaseServiceClient>,
  orderId: string,
  status: OrderStatus,
  prevStatus: string | null | undefined
): Promise<string | null> {
  const patch: OrderUpdate = { status };
  // Leaving a hold clears its note.
  if (status !== "on_hold" && prevStatus === "on_hold") patch.hold_note = null;
  const { error } = await service.from("orders").update(patch).eq("id", orderId);
  if (error) return error.message;
  await logActivity(service, orderId, "status_change", { from: prevStatus, to: status });
  await sendOrderStatusEmail(orderId, status);
  return null;
}

export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();

  const { data: prev } = await service.from("orders").select("status").eq("id", orderId).single();
  const err = await applyStatus(service, orderId, status, prev?.status);
  if (err) return { error: err };
  revalidateOrder(orderId);
  return { ok: true };
}

/** Statuses from which saving a tracking number auto-advances a ship order to "shipped". */
const SHIP_ON_TRACKING = new Set<string>([
  "submitted", "in_review", "proof_ready", "changes_requested", "approved", "in_production", "quality_check",
]);

export async function setPaymentStatusAction(
  orderId: string,
  paymentStatus: PaymentStatus
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const { error } = await service.from("orders").update({ payment_status: paymentStatus }).eq("id", orderId);
  if (error) return { error: error.message };
  await logActivity(service, orderId, "payment_status", { to: paymentStatus });
  revalidateOrder(orderId);
  return { ok: true };
}

export async function addOrderNoteAction(
  orderId: string,
  text: string,
  visibility: "internal" | "customer"
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const profile = await getProfile();

  const { data: order } = await service
    .from("orders")
    .select("internal_notes, customer_notes")
    .eq("id", orderId)
    .single();
  const current = visibility === "internal" ? order?.internal_notes : order?.customer_notes;
  const existing = (current ?? []) as unknown as { at: string; actor: string; text: string }[];
  const note = { at: new Date().toISOString(), actor: profile?.name ?? "Staff", text };
  const merged = asJson([...existing, note]);

  const patch: OrderUpdate = visibility === "internal" ? { internal_notes: merged } : { customer_notes: merged };
  const { error } = await service.from("orders").update(patch).eq("id", orderId);
  if (error) return { error: error.message };
  await logActivity(service, orderId, "note", { visibility });
  // A customer-visible comment reaches the customer's inbox too, with a link
  // back to their order page. Internal notes stay internal.
  if (visibility === "customer") {
    await sendOrderCommentEmail(orderId, text);
  }
  revalidateOrder(orderId);
  return { ok: true };
}

export async function updateOrderPricingAction(
  orderId: string,
  pricing: {
    subtotal: number;
    setupFees: number;
    rush: number;
    addons: number;
    shipping: number;
    tax: number;
    total: number;
    discountType?: DiscountType;
    discountValue?: number;
    discountLabel?: string;
    discount?: number;
  }
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.pricing");
  const service = requireSupabaseServiceClient();
  const { error } = await service.from("orders").update({ pricing: asJson(pricing) }).eq("id", orderId);
  if (error) return { error: error.message };
  await logActivity(service, orderId, "price_edit", { total: pricing.total });
  revalidateOrder(orderId);
  return { ok: true };
}

export interface OrderDetailsInput {
  /** Written to the customer's profile when the order has one. */
  contactName?: string;
  contactPhone?: string;
  /** Guest orders only — the notification email. */
  guestEmail?: string;
  shipping: {
    name?: string;
    company?: string;
    phone?: string;
    street?: string;
    city?: string;
    prov?: string;
    postal?: string;
  };
  billing: { name?: string; email?: string; company?: string } | null;
  shippingMethod: string;
  fulfillmentMethod: string;
}

export async function updateOrderDetailsAction(
  orderId: string,
  input: OrderDetailsInput
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();

  const { data: order } = await service
    .from("orders")
    .select("customer_id, shipping_address")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found." };

  const existingShip = (order.shipping_address ?? {}) as Record<string, unknown>;
  const patch: OrderUpdate = {
    shipping_address: asJson({ ...existingShip, ...input.shipping }),
    billing_address: input.billing ? asJson(input.billing) : null,
    shipping_method: input.shippingMethod,
    fulfillment_method: input.fulfillmentMethod,
  };
  if (!order.customer_id && input.guestEmail !== undefined) {
    patch.guest_email = input.guestEmail.trim() || null;
  }
  const { error } = await service.from("orders").update(patch).eq("id", orderId);
  if (error) return { error: error.message };

  if (order.customer_id && (input.contactName !== undefined || input.contactPhone !== undefined)) {
    const profilePatch: { name?: string; phone?: string } = {};
    if (input.contactName?.trim()) profilePatch.name = input.contactName.trim();
    if (input.contactPhone !== undefined) profilePatch.phone = input.contactPhone.trim();
    if (Object.keys(profilePatch).length) {
      await service.from("profiles").update(profilePatch).eq("id", order.customer_id);
    }
  }

  await logActivity(service, orderId, "details_updated", {});
  revalidateOrder(orderId);
  return { ok: true };
}

/** One decoration placement ("spot") on a garment — stored in line_items.decorations. */
export interface DecorationSpot {
  location: string;
  type: string;
  widthIn: string;
  heightIn: string;
  colours: string;
  pantones: string[];
  puff: boolean;
  spotProcess: boolean;
}

export interface LineItemDecorations {
  spots: DecorationSpot[];
  bagging: boolean;
  sewnTags: boolean;
  priceConfirmed: boolean;
  /** Per-line production tracking (independent of the order status). */
  productionStatus?: LineProductionStatus;
  /** Manufacturing instructions for this line (e.g. white underbase on darks). */
  productionNotes?: string;
  /** Private team notes — never shown to the customer. */
  internalNotes?: string;
  /** Info for the shipping label (e.g. gate code, delivery instructions). */
  shippingNotes?: string;
  /** Manual queue order within the order (lower = higher up). */
  position?: number;
}

export interface LineItemPatch {
  id: string;
  productName: string;
  sizeQuantities: Record<string, number>;
  unitPrice: number;
  decorations: LineItemDecorations;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sumSizes = (sq: Record<string, number>) =>
  Object.values(sq).reduce((a, b) => a + (Number(b) > 0 ? Number(b) : 0), 0);

/** Recompute order pricing from its line items (subtotal excludes setup, which lives on the lines). */
async function syncOrderPricing(service: ReturnType<typeof requireSupabaseServiceClient>, orderId: string) {
  const [{ data: items }, { data: order }, { data: addonRow }] = await Promise.all([
    service.from("line_items").select("unit_price, size_quantities, decorations").eq("order_id", orderId),
    service.from("orders").select("pricing").eq("id", orderId).single(),
    service.from("settings").select("value").eq("key", "addons").maybeSingle(),
  ]);
  const pricing = (order?.pricing ?? {}) as {
    setupFees?: number;
    rush?: number;
    shipping?: number;
    tax?: number;
    discountType?: DiscountType;
    discountValue?: number;
    discountLabel?: string;
  };
  const addonSettings = mergeAddonSettings(addonRow?.value);
  const subtotal = round2(
    (items ?? []).reduce((sum, li) => sum + li.unit_price * sumSizes((li.size_quantities ?? {}) as Record<string, number>), 0)
  );
  // Per-unit add-on charges (bagging / sewn tags / spot process) driven by the line checkboxes.
  const addons = round2(
    (items ?? []).reduce((sum, li) => {
      const dec = (li.decorations ?? {}) as Partial<LineItemDecorations>;
      return sum + lineAddonTotal(dec, sumSizes((li.size_quantities ?? {}) as Record<string, number>), addonSettings);
    }, 0)
  );
  const setupFees = pricing.setupFees ?? 0;
  const rush = pricing.rush ?? 0;
  const shipping = pricing.shipping ?? 0;
  const tax = pricing.tax ?? 0;
  // Preserve the admin's manual discount across auto-recompute (re-resolve against the new goods).
  const discountType = pricing.discountType;
  const discountValue = pricing.discountValue;
  const discountLabel = pricing.discountLabel;
  const discount = resolveDiscount(subtotal + setupFees + rush + addons, { discountType, discountValue });
  const next = {
    subtotal,
    setupFees,
    rush,
    addons,
    shipping,
    tax,
    discountType,
    discountValue,
    discountLabel,
    discount,
    total: round2(subtotal + setupFees + rush + addons - discount + shipping + tax),
  };
  await service.from("orders").update({ pricing: asJson(next) }).eq("id", orderId);
  return next;
}

export async function updateLineItemsAction(
  orderId: string,
  items: LineItemPatch[]
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const profile = await getProfile();
  const canPrice = hasPermission(profile, "orders.pricing");

  const { data: existing } = await service
    .from("line_items")
    .select("id, unit_price, setup_fee")
    .eq("order_id", orderId);
  const byId = new Map((existing ?? []).map((li) => [li.id, li]));

  for (const patch of items) {
    const row = byId.get(patch.id);
    if (!row) return { error: "Line item not found on this order." };
    // Unit price changes require the pricing permission; others keep the stored price.
    const unitPrice = canPrice ? patch.unitPrice : row.unit_price;
    const qty = sumSizes(patch.sizeQuantities);
    const { error } = await service
      .from("line_items")
      .update({
        product_name: patch.productName.trim() || null,
        size_quantities: asJson(patch.sizeQuantities),
        unit_price: unitPrice,
        decorations: asJson(patch.decorations),
        line_total: round2(unitPrice * qty + row.setup_fee),
      })
      .eq("id", patch.id);
    if (error) return { error: error.message };
  }

  const pricing = await syncOrderPricing(service, orderId);
  await logActivity(service, orderId, "items_updated", { count: items.length, total: pricing.total });
  revalidateOrder(orderId);
  return { ok: true };
}

export async function deleteLineItemAction(
  orderId: string,
  lineItemId: string
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const { error } = await service.from("line_items").delete().eq("id", lineItemId).eq("order_id", orderId);
  if (error) return { error: error.message };
  await syncOrderPricing(service, orderId);
  await logActivity(service, orderId, "item_removed", {});
  revalidateOrder(orderId);
  return { ok: true };
}

/** Upload an official mockup/proof (already staged in the proofs bucket) and move to proof_ready. */
export async function uploadProofsAction(
  orderId: string,
  proofPaths: string[],
  lineItemId?: string
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("proofs.manage");
  const service = requireSupabaseServiceClient();
  const profile = await getProfile();

  const paths = proofPaths.filter(Boolean);
  if (paths.length === 0) return { error: "No proof files to send." };

  // Sign every uploaded file (front / back / …); a single unsignable file
  // fails the whole batch so the customer never gets a partial proof set.
  const signed: { url: string; path: string }[] = [];
  for (const path of paths) {
    const { data } = await service.storage.from("proofs").createSignedUrl(path, YEAR);
    if (!data?.signedUrl) return { error: "Could not sign one of the uploaded proofs." };
    signed.push({ url: data.signedUrl, path });
  }

  const { error: pErr } = await service.from("proofs").insert(
    signed.map((s) => ({
      order_id: orderId,
      line_item_id: lineItemId ?? null,
      image: s.url,
      status: "pending" as const,
      created_by: profile?.id ?? null,
    }))
  );
  if (pErr) return { error: pErr.message };

  // Append all to official mockups and advance status once.
  const { data: order } = await service.from("orders").select("official_mockups").eq("id", orderId).single();
  const mockups = (order?.official_mockups ?? []) as { url: string; path: string }[];
  await service
    .from("orders")
    .update({
      official_mockups: asJson([...mockups, ...signed]),
      status: "proof_ready",
    })
    .eq("id", orderId);

  await logActivity(service, orderId, "proof_uploaded", { count: signed.length });
  // One email for the whole set — the proof page shows every image.
  await sendOrderStatusEmail(orderId, "proof_ready");
  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * Email (or re-email) the payment link: mint/reuse a Stripe Checkout session
 * for the current order total, stamp invoice fields, and send the customer
 * their public order link with the Pay button. OPTIONAL in the approve-and-pay
 * flow (an approved order is payable self-serve) — this is the nudge/reminder,
 * and the only way to open payment BEFORE proof approval. Requires the pricing
 * permission.
 */
export async function sendInvoiceAction(orderId: string): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.pricing");
  const service = requireSupabaseServiceClient();

  const { data: order } = await service
    .from("orders")
    .select("id, order_number, public_token, customer_id, guest_email, pricing, status, stripe_checkout_session_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "Order not found." };
  if (order.status === "draft" || order.status === "cancelled") {
    return { error: "Can't invoice a draft or cancelled order." };
  }

  const session = await ensureCheckoutSession(service, order);
  if (session.error) return { error: session.error };

  const pricing = (order.pricing ?? {}) as { total?: number };
  const { error } = await service
    .from("orders")
    .update({ invoice_sent_at: new Date().toISOString(), invoice_amount: pricing.total ?? null })
    .eq("id", orderId);
  if (error) return { error: error.message };

  await logActivity(service, orderId, "invoice_sent", { total: pricing.total ?? 0 });
  await sendOrderEmail(orderId, "invoice_sent");
  revalidateOrder(orderId);
  return { ok: true };
}

/** Set the shipment tracking number (shows on the customer's order page + shipped email). */
export async function setTrackingAction(
  orderId: string,
  tracking: string
): Promise<{ ok?: boolean; error?: string; shipped?: boolean }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const value = tracking.trim() || null;

  const { data: prev } = await service.from("orders").select("status, fulfillment_method").eq("id", orderId).single();
  const { error } = await service.from("orders").update({ shipping_tracking: value }).eq("id", orderId);
  if (error) return { error: error.message };
  await logActivity(service, orderId, "tracking_updated", { tracking: value });

  // Saving a real tracking number on a ship order that hasn't shipped yet marks it shipped.
  let shipped = false;
  if (value && prev?.fulfillment_method === "ship" && SHIP_ON_TRACKING.has(prev.status)) {
    const err = await applyStatus(service, orderId, "shipped", prev.status);
    if (err) return { error: err };
    shipped = true;
  }

  revalidateOrder(orderId);
  return { ok: true, shipped };
}

/** The three static note fields at the bottom of the order page (customer / inventory / printer). */
export async function updateProductionNotesAction(
  orderId: string,
  notes: ProductionNotesJson
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const clean: ProductionNotesJson = {
    customer: notes.customer?.trim() || undefined,
    inventory: notes.inventory?.trim() || undefined,
    printer: notes.printer?.trim() || undefined,
  };
  const { error } = await service.from("orders").update({ production_notes: asJson(clean) }).eq("id", orderId);
  if (error) return { error: error.message };
  revalidateOrder(orderId);
  return { ok: true };
}
