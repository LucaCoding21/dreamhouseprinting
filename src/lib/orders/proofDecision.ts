import "server-only";

import { revalidatePath } from "next/cache";
import { notifyJulian } from "@/lib/notify";
import type { Json } from "@/lib/db/types";
import type { OrderStatus } from "@/lib/db/rows";
import type { requireSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Shared cores for the customer's proof decision, used by BOTH auth modes:
 * the logged-in portal (/account/orders/[id], RLS-ownership-checked) and the
 * public tokenized page (/o/[token], token-authorized). Callers must have
 * already verified the actor may act on this proof/order.
 */

type Service = ReturnType<typeof requireSupabaseServiceClient>;
const asJson = (v: unknown) => v as unknown as Json;

/**
 * Order statuses where a customer proof decision still means something. Outside
 * this set the order has moved on (cancelled, already approved / in production,
 * completed) and the proof is locked — a stale tab must not regress it.
 */
const ACTIONABLE_PROOF_STATUSES = new Set<OrderStatus>([
  "submitted",
  "in_review",
  "proof_ready",
  "changes_requested",
]);

function proofLockedMessage(status: OrderStatus): string {
  if (status === "cancelled") {
    return "This order was cancelled, so its proof can't be updated. Contact us if something looks wrong.";
  }
  if (status === "completed") {
    return "This order is already complete, so its proof can't be updated. Contact us if something looks wrong.";
  }
  return "This proof has already been reviewed and can't be updated any more. Contact us if something looks wrong.";
}

function revalidateOrderViews(orderId: string) {
  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

async function orderLabel(service: Service, orderId: string): Promise<string> {
  const { data } = await service.from("orders").select("order_number").eq("id", orderId).maybeSingle();
  return data?.order_number ?? orderId;
}

export async function approveProofCore(
  service: Service,
  orderId: string,
  proofId: string,
  actorName: string
): Promise<{ ok?: boolean; error?: string }> {
  // Guard against acting on an order that has already moved on (cancelled /
  // approved / in production / completed): a stale tab must not resurrect it.
  const { data: order, error: orderErr } = await service
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) return { error: orderErr.message };
  if (!order) return { error: "Order not found." };
  if (!ACTIONABLE_PROOF_STATUSES.has(order.status as OrderStatus)) {
    return { error: proofLockedMessage(order.status as OrderStatus) };
  }

  // A proof set (front / back / …) is sent together and reviewed as one — the
  // decision covers every still-pending proof on the order, not just the tile
  // the customer clicked, so no sibling lingers pending after approval.
  const { data: transitioned, error } = await service
    .from("proofs")
    .update({ status: "approved" })
    .eq("order_id", orderId)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: error.message };
  // No pending proof transitioned (stale tab re-submitting the same decision):
  // idempotent no-op — leave order status / activity / notifications untouched.
  if (!transitioned || transitioned.length === 0) return { ok: true };

  await service.from("orders").update({ status: "approved" }).eq("id", orderId);
  await service.from("order_activity").insert({
    order_id: orderId,
    actor_name: actorName,
    type: "proof_approved",
    detail: asJson({ proofId }),
  });

  const label = await orderLabel(service, orderId);
  await notifyJulian(
    `Proof approved — ${label}`,
    `The customer approved the proof on order ${label} and was taken straight to payment — you'll get another email once it's paid. If pricing changed since the proof went out, update it on the order page; the payment amount always follows the current total.`,
    { orderId, kicker: "Proof approved", tone: "success", amountLabel: "Awaiting payment" }
  );

  revalidateOrderViews(orderId);
  return { ok: true };
}

export async function requestProofChangesCore(
  service: Service,
  orderId: string,
  proofId: string,
  comment: string,
  actorName: string
): Promise<{ ok?: boolean; error?: string }> {
  if (!comment.trim()) return { error: "Tell us what to change." };

  // Same status guard as approveProofCore — don't act on a locked order.
  const { data: order, error: orderErr } = await service
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) return { error: orderErr.message };
  if (!order) return { error: "Order not found." };
  if (!ACTIONABLE_PROOF_STATUSES.has(order.status as OrderStatus)) {
    return { error: proofLockedMessage(order.status as OrderStatus) };
  }

  // Applies to the whole current proof set (see approveProofCore).
  const { data: transitioned, error } = await service
    .from("proofs")
    .update({ status: "changes_requested", change_request_comment: comment })
    .eq("order_id", orderId)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: error.message };
  // Nothing pending transitioned (stale tab): idempotent no-op.
  if (!transitioned || transitioned.length === 0) return { ok: true };

  await service.from("orders").update({ status: "changes_requested" }).eq("id", orderId);
  await service.from("order_activity").insert({
    order_id: orderId,
    actor_name: actorName,
    type: "changes_requested",
    detail: asJson({ proofId, comment }),
  });

  const label = await orderLabel(service, orderId);
  await notifyJulian(
    `Changes requested — ${label}`,
    `The customer requested changes on order ${label}:\n\n"${comment.trim()}"`,
    { orderId, kicker: "Changes requested", tone: "warn" }
  );

  revalidateOrderViews(orderId);
  return { ok: true };
}
