import "server-only";

import { revalidatePath } from "next/cache";
import { notifyJulian } from "@/lib/notify";
import type { Json } from "@/lib/db/types";
import type { requireSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Shared cores for the customer's proof decision, used by BOTH auth modes:
 * the logged-in portal (/account/orders/[id], RLS-ownership-checked) and the
 * public tokenized page (/o/[token], token-authorized). Callers must have
 * already verified the actor may act on this proof/order.
 */

type Service = ReturnType<typeof requireSupabaseServiceClient>;
const asJson = (v: unknown) => v as unknown as Json;

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
  // A proof set (front / back / …) is sent together and reviewed as one — the
  // decision covers every still-pending proof on the order, not just the tile
  // the customer clicked, so no sibling lingers pending after approval.
  const { error } = await service
    .from("proofs")
    .update({ status: "approved" })
    .eq("order_id", orderId)
    .eq("status", "pending");
  if (error) return { error: error.message };

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
    `The customer approved the proof on order ${label} and was taken straight to payment — you'll get another email once it's paid. If pricing changed since the proof went out, update it on the order page; the payment amount always follows the current total.`
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

  // Applies to the whole current proof set (see approveProofCore).
  const { error } = await service
    .from("proofs")
    .update({ status: "changes_requested", change_request_comment: comment })
    .eq("order_id", orderId)
    .eq("status", "pending");
  if (error) return { error: error.message };

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
    `The customer requested changes on order ${label}:\n\n"${comment.trim()}"`
  );

  revalidateOrderViews(orderId);
  return { ok: true };
}
