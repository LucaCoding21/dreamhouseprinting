"use server";

import { getUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { ensureCheckoutSession, orderPayableError, reportEtransferCore } from "@/lib/orders/payments";

/**
 * Mint (or reuse) a Stripe Checkout session for the logged-in customer's order.
 * Authorization is the RLS read: `createSupabaseServerClient` only returns the
 * order if the current user may see it. The public /o/[token] route has its own
 * token-authorized equivalent (payNowPublicAction).
 */
export async function payNowAction(orderId: string): Promise<{ url?: string; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const supa = await createSupabaseServerClient();
  const { data: order } = await supa
    .from("orders")
    .select("id, order_number, public_token, customer_id, guest_email, pricing, stripe_checkout_session_id, invoice_sent_at, paid_at, payment_status, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "Order not found" };

  const notPayable = orderPayableError(order);
  if (notPayable) return { error: notPayable };

  return ensureCheckoutSession(requireSupabaseServiceClient(), order);
}

/**
 * The logged-in customer says their Interac e-Transfer is sent. Authorization
 * is the RLS read, same as payNowAction; the write runs on the service client.
 */
export async function reportEtransferAction(orderId: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const supa = await createSupabaseServerClient();
  const { data: order } = await supa.from("orders").select("id").eq("id", orderId).maybeSingle();
  if (!order) return { error: "Order not found" };

  return reportEtransferCore(requireSupabaseServiceClient(), order.id);
}
