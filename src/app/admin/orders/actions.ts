"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, getProfile } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
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
  revalidateOrder(orderId);
  return { ok: true };
}
