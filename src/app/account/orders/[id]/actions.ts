"use server";

import { getUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { approveProofCore, requestProofChangesCore } from "@/lib/orders/proofDecision";

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
  return approveProofCore(requireSupabaseServiceClient(), owns.orderId, proofId, "Customer");
}

export async function requestProofChangesAction(
  proofId: string,
  comment: string
): Promise<{ ok?: boolean; error?: string }> {
  const owns = await assertOwnsProof(proofId);
  if ("error" in owns) return { error: owns.error };
  return requestProofChangesCore(requireSupabaseServiceClient(), owns.orderId, proofId, comment, "Customer");
}
