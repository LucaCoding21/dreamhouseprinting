import "server-only";

import Stripe from "stripe";

/**
 * Lazy server-side Stripe client. Payments use hosted Checkout only (no
 * client-side Stripe.js) — admin "Send invoice" mints a session, the customer
 * pays on stripe.com, and the webhook/reconcile path marks the order paid.
 * Degrades to null when STRIPE_SECRET_KEY is absent (local dev without keys).
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}
