import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { markOrderPaid } from "@/lib/orders/payments";

/**
 * Stripe webhook — the authoritative "order paid" signal. Dev:
 *   stripe listen --forward-to localhost:3001/api/stripe/webhook
 * (put the printed whsec_… in STRIPE_WEBHOOK_SECRET). The public order page
 * also reconciles on the success redirect, so a missed webhook can't strand
 * an order as unpaid; markOrderPaid is idempotent across both paths.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe not configured", { status: 503 });

  const body = await req.text(); // raw body — signature verification needs it untouched
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (orderId && session.payment_status === "paid") {
      const service = requireSupabaseServiceClient();
      await markOrderPaid(service, orderId, session.id, "webhook");
    }
  }

  return new Response("ok", { status: 200 });
}
