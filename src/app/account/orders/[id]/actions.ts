"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/db/types";

const asJson = (v: unknown) => v as unknown as Json;

/** Verify the logged-in customer owns the order behind a proof. Returns the order id. */
async function assertOwnsProof(proofId: string): Promise<{ orderId: string } | { error: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };
  // RLS lets the customer read proofs only for their own orders.
  const supa = await createSupabaseServerClient();
  const { data: proof } = await supa.from("proofs").select("id, order_id").eq("id", proofId).maybeSingle();
  if (!proof) return { error: "Proof not found" };
  return { orderId: proof.order_id };
}

export async function approveProofAction(proofId: string): Promise<{ ok?: boolean; error?: string }> {
  const owns = await assertOwnsProof(proofId);
  if ("error" in owns) return { error: owns.error };
  const service = requireSupabaseServiceClient();

  const { error } = await service.from("proofs").update({ status: "approved" }).eq("id", proofId);
  if (error) return { error: error.message };

  await service.from("orders").update({ status: "approved" }).eq("id", owns.orderId);
  await service.from("order_activity").insert({
    order_id: owns.orderId,
    actor_name: "Customer",
    type: "proof_approved",
    detail: asJson({ proofId }),
  });

  revalidatePath(`/account/orders/${owns.orderId}`);
  revalidatePath(`/admin/orders/${owns.orderId}`);
  return { ok: true };
}

export async function requestProofChangesAction(
  proofId: string,
  comment: string
): Promise<{ ok?: boolean; error?: string }> {
  const owns = await assertOwnsProof(proofId);
  if ("error" in owns) return { error: owns.error };
  if (!comment.trim()) return { error: "Tell us what to change." };
  const service = requireSupabaseServiceClient();

  const { error } = await service
    .from("proofs")
    .update({ status: "changes_requested", change_request_comment: comment })
    .eq("id", proofId);
  if (error) return { error: error.message };

  await service.from("orders").update({ status: "changes_requested" }).eq("id", owns.orderId);
  await service.from("order_activity").insert({
    order_id: owns.orderId,
    actor_name: "Customer",
    type: "changes_requested",
    detail: asJson({ proofId, comment }),
  });

  revalidatePath(`/account/orders/${owns.orderId}`);
  revalidatePath(`/admin/orders/${owns.orderId}`);
  return { ok: true };
}
