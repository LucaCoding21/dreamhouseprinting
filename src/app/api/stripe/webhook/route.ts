import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { markOrderPaid } from "@/lib/orders/payments";
import { notifyJulian } from "@/lib/notify";
import { formatCAD } from "@/lib/money";

/**
 * Stripe webhook, the authoritative "order paid" signal. Dev:
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

  const body = await req.text(); // raw body, signature verification needs it untouched
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
      const { data: order } = await service
        .from("orders")
        .select("status, order_number")
        .eq("id", orderId)
        .maybeSingle();

      if (order?.status === "cancelled") {
        // Payment landed on an order that was cancelled after the session was
        // created (e.g. customer paid an old link). Do NOT mark it paid, alert
        // Julian to refund it manually in Stripe. Return 200 so Stripe doesn't
        // retry the (correctly-handled) event.
        const label = order.order_number ?? orderId;
        const amount = formatCAD((session.amount_total ?? 0) / 100);
        await notifyJulian(
          `Payment on a CANCELLED order, ${label}`,
          `${amount} was paid on order ${label}, but that order is CANCELLED. It has NOT been marked paid. Refund the customer in Stripe.`,
          { orderId, kicker: "Refund needed", tone: "warn", amountLabel: "Amount to refund" }
        );
      } else {
        await markOrderPaid(service, orderId, session.id, "webhook");
      }
    }
  }

  return new Response("ok", { status: 200 });
}
