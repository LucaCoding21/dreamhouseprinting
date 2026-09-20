"use server";

import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { approveProofCore, requestProofChangesCore } from "@/lib/orders/proofDecision";
import { ensureCheckoutSession, orderPayableError, reportEtransferCore } from "@/lib/orders/payments";

/**
 * Server actions for the public, no-login order page. The unguessable
 * public_token IS the authorization: whoever holds the link may act on the
 * order. We load the order by token with the service client (bypasses RLS,
 * which is fine here) and, for proof actions, verify the proof belongs to it.
 */

async function orderIdForToken(token: string): Promise<string | null> {
  const service = requireSupabaseServiceClient();
  const { data } = await service.from("orders").select("id").eq("public_token", token).maybeSingle();
  return data?.id ?? null;
}

/** Confirm the proof belongs to the token's order, returning the order id. */
async function assertProofOnOrder(token: string, proofId: string): Promise<{ orderId: string } | { error: string }> {
  const orderId = await orderIdForToken(token);
  if (!orderId) return { error: "Order not found" };
  const service = requireSupabaseServiceClient();
  const { data: proof } = await service.from("proofs").select("order_id").eq("id", proofId).maybeSingle();
  if (!proof || proof.order_id !== orderId) return { error: "Proof not found" };
  return { orderId };
}

export async function approveProofPublicAction(
  token: string,
  proofId: string
): Promise<{ ok?: boolean; error?: string }> {
  const owns = await assertProofOnOrder(token, proofId);
  if ("error" in owns) return { error: owns.error };
  return approveProofCore(requireSupabaseServiceClient(), owns.orderId, proofId, "Customer");
}

export async function requestProofChangesPublicAction(
  token: string,
  proofId: string,
  comment: string
): Promise<{ ok?: boolean; error?: string }> {
  const owns = await assertProofOnOrder(token, proofId);
  if ("error" in owns) return { error: owns.error };
  return requestProofChangesCore(requireSupabaseServiceClient(), owns.orderId, proofId, comment, "Customer");
}

export async function payNowPublicAction(token: string): Promise<{ url?: string; error?: string }> {
  const service = requireSupabaseServiceClient();
  const { data: order } = await service
    .from("orders")
    .select("id, order_number, public_token, customer_id, guest_email, pricing, stripe_checkout_session_id, invoice_sent_at, paid_at, payment_status, status")
    .eq("public_token", token)
    .maybeSingle();
  if (!order) return { error: "Order not found" };

  const notPayable = orderPayableError(order);
  if (notPayable) return { error: notPayable };

  return ensureCheckoutSession(service, order);
}

/** Customer on the public order page says their Interac e-Transfer is sent. */
export async function reportEtransferPublicAction(token: string): Promise<{ ok?: boolean; error?: string }> {
  const orderId = await orderIdForToken(token);
  if (!orderId) return { error: "Order not found" };
  return reportEtransferCore(requireSupabaseServiceClient(), orderId);
}
