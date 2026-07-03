"use server";

import { getUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { ensureCheckoutSession } from "@/lib/orders/payments";

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
    .select("id, order_number, public_token, customer_id, guest_email, pricing, stripe_checkout_session_id, invoice_sent_at, paid_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "Order not found" };

  if (!order.invoice_sent_at) return { error: "This order hasn't been invoiced yet." };
  if (order.paid_at) return { error: "This order is already paid." };

  return ensureCheckoutSession(requireSupabaseServiceClient(), order);
}
