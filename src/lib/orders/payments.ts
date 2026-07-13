import "server-only";

import { revalidatePath } from "next/cache";
import { getStripe } from "@/lib/stripe";
import { sendOrderEmail, notifyJulian } from "@/lib/notify";
import { publicOrderPath, appOrigin } from "@/lib/orders/publicLink";
import { formatCAD } from "@/lib/money";
import { PAYABLE_ORDER_STATUSES } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/rows";
import type { Json } from "@/lib/db/types";
import type { requireSupabaseServiceClient } from "@/lib/supabase/service";

type Service = ReturnType<typeof requireSupabaseServiceClient>;
const asJson = (v: unknown) => v as unknown as Json;

/**
 * Why an order can't be paid right now, or null when it can. Payability is
 * approval-driven (approve-and-pay): once the proof is approved the customer
 * pays self-serve at the CURRENT pricing.total — an explicit invoice email is
 * only required for pre-approval payment.
 */
export function orderPayableError(order: {
  status: string;
  paid_at: string | null;
  invoice_sent_at: string | null;
  pricing: Json;
}): string | null {
  if (order.paid_at) return "This order is already paid.";
  if (order.status === "cancelled") return "This order was cancelled.";
  const pricing = (order.pricing ?? {}) as { total?: number };
  if (!(typeof pricing.total === "number" && pricing.total > 0)) {
    return "This order doesn't have a total yet — we'll email you when it's ready to pay.";
  }
  if (!PAYABLE_ORDER_STATUSES.has(order.status as OrderStatus) && !order.invoice_sent_at) {
    return "Payment opens as soon as you approve your proof.";
  }
  return null;
}

interface CheckoutOrder {
  id: string;
  order_number: string | null;
  public_token: string;
  customer_id: string | null;
  guest_email: string | null;
  pricing: Json;
  stripe_checkout_session_id: string | null;
}

const orderTotal = (order: CheckoutOrder): number => {
  const pricing = (order.pricing ?? {}) as { total?: number };
  return typeof pricing.total === "number" ? pricing.total : 0;
};

/**
 * Return a payable Stripe Checkout session URL for the order — reusing the
 * stored session when it is still open AND its amount matches the current
 * order total (a price edit after invoicing mints a fresh session so the
 * customer can never underpay), else creating and storing a new one.
 */
export async function ensureCheckoutSession(
  service: Service,
  order: CheckoutOrder
): Promise<{ url?: string; sessionId?: string; error?: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe isn't configured (STRIPE_SECRET_KEY missing)." };

  const total = orderTotal(order);
  if (total <= 0) return { error: "Order total must be greater than zero before invoicing." };
  const amountCents = Math.round(total * 100);

  if (order.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
      if (existing.status === "open" && existing.amount_total === amountCents && existing.url) {
        return { url: existing.url, sessionId: existing.id };
      }
      // Stale (expired/completed/amount drift) — expire an open mismatch so
      // the old link in the customer's inbox can't charge the wrong amount.
      if (existing.status === "open") {
        await stripe.checkout.sessions.expire(existing.id).catch(() => {});
      }
    } catch {
      // Session id not retrievable (deleted test data etc.) — fall through.
    }
  }

  let email = order.guest_email ?? undefined;
  if (order.customer_id) {
    const { data: customer } = await service
      .from("profiles")
      .select("email")
      .eq("id", order.customer_id)
      .maybeSingle();
    email = customer?.email ?? email;
  }

  const origin = await appOrigin();
  const orderPage = `${origin}${publicOrderPath(order.public_token)}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "cad",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            product_data: { name: `Dreamhouse Printing — Order ${order.order_number ?? order.id}` },
            unit_amount: amountCents,
          },
        },
      ],
      customer_email: email,
      metadata: { order_id: order.id, order_number: order.order_number ?? "" },
      success_url: `${orderPage}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: orderPage,
    });
    if (!session.url) return { error: "Stripe did not return a checkout URL." };

    await service.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
    return { url: session.url, sessionId: session.id };
  } catch (e) {
    console.error("[payments] checkout session create failed", e);
    return { error: "Could not create the Stripe checkout session." };
  }
}

/**
 * Mark an order paid. Idempotent across the webhook / reconcile-on-return
 * race: the UPDATE is guarded on `paid_at is null`, so only the first caller
 * logs activity and sends emails.
 */
export async function markOrderPaid(
  service: Service,
  orderId: string,
  sessionId: string,
  source: "webhook" | "reconcile",
  /** Pass false when calling during a page RENDER (reconcile-on-return) — revalidatePath is illegal there. */
  revalidate = true
): Promise<{ ok?: boolean; alreadyPaid?: boolean; error?: string }> {
  const { data: updated, error } = await service
    .from("orders")
    .update({ payment_status: "paid_in_full", paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("paid_at", null)
    .select("id, order_number, pricing")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { ok: true, alreadyPaid: true }; // the other path won the race

  await service.from("order_activity").insert({
    order_id: orderId,
    actor_name: "Stripe",
    type: "payment_received",
    detail: asJson({ sessionId, source }),
  });

  const pricing = (updated.pricing ?? {}) as { total?: number };
  const label = updated.order_number ?? orderId;
  await sendOrderEmail(orderId, "payment_received");
  await notifyJulian(
    `Payment received — ${label}`,
    `${formatCAD(pricing.total ?? 0)} was paid on order ${label} via Stripe. It's ready for production.`
  );

  if (revalidate) {
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    revalidatePath(`/account/orders/${orderId}`);
  }
  return { ok: true };
}
