"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, getProfile, hasPermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { sendOrderStatusEmail } from "@/lib/notify";
import type { Json, Database } from "@/lib/db/types";
import type { OrderStatus, PaymentStatus } from "@/lib/db/rows";

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

export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();

  const { data: prev } = await service.from("orders").select("status").eq("id", orderId).single();
  const patch: OrderUpdate = { status };
  // Leaving a hold clears its note.
  if (status !== "on_hold" && prev?.status === "on_hold") patch.hold_note = null;

  const { error } = await service.from("orders").update(patch).eq("id", orderId);
  if (error) return { error: error.message };

  await logActivity(service, orderId, "status_change", { from: prev?.status, to: status });
  await sendOrderStatusEmail(orderId, status);
  revalidateOrder(orderId);
  return { ok: true };
}

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
  revalidateOrder(orderId);
  return { ok: true };
}

export async function updateOrderPricingAction(
  orderId: string,
  pricing: { subtotal: number; setupFees: number; shipping: number; tax: number; total: number }
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
  const [{ data: items }, { data: order }] = await Promise.all([
    service.from("line_items").select("unit_price, size_quantities").eq("order_id", orderId),
    service.from("orders").select("pricing").eq("id", orderId).single(),
  ]);
  const pricing = (order?.pricing ?? {}) as { setupFees?: number; shipping?: number; tax?: number };
  const subtotal = round2(
    (items ?? []).reduce((sum, li) => sum + li.unit_price * sumSizes((li.size_quantities ?? {}) as Record<string, number>), 0)
  );
  const setupFees = pricing.setupFees ?? 0;
  const shipping = pricing.shipping ?? 0;
  const tax = pricing.tax ?? 0;
  const next = { subtotal, setupFees, shipping, tax, total: round2(subtotal + setupFees + shipping + tax) };
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
export async function uploadProofAction(
  orderId: string,
  proofPath: string
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("proofs.manage");
  const service = requireSupabaseServiceClient();
  const profile = await getProfile();

  const { data: signed } = await service.storage.from("proofs").createSignedUrl(proofPath, YEAR);
  const url = signed?.signedUrl ?? null;
  if (!url) return { error: "Could not sign the uploaded proof." };

  const { error: pErr } = await service.from("proofs").insert({
    order_id: orderId,
    image: url,
    status: "pending",
    created_by: profile?.id ?? null,
  });
  if (pErr) return { error: pErr.message };

  // Append to official mockups and advance status.
  const { data: order } = await service.from("orders").select("official_mockups").eq("id", orderId).single();
  const mockups = (order?.official_mockups ?? []) as { url: string; path: string }[];
  await service
    .from("orders")
    .update({
      official_mockups: asJson([...mockups, { url, path: proofPath }]),
      status: "proof_ready",
    })
    .eq("id", orderId);

  await logActivity(service, orderId, "proof_uploaded", {});
  await sendOrderStatusEmail(orderId, "proof_ready");
  revalidateOrder(orderId);
  return { ok: true };
}
