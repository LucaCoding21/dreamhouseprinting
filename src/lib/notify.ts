import "server-only";

import { Resend } from "resend";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { publicOrderUrl } from "@/lib/orders/publicLink";
import { formatCAD } from "@/lib/money";
import type { OrderStatus } from "@/lib/db/rows";

/**
 * Transactional order notifications (PRD §10.1). The SAME status change that
 * advances the tracker triggers the email — one event, both effects. Templates
 * live in the `settings` row keyed 'email_templates' (editable in Admin →
 * Settings); the customer's notification_preferences gate delivery. Degrades to
 * a no-op when Resend isn't configured (local dev).
 *
 * Recipient resolution: the customer's profile email, or `orders.guest_email`
 * for guest orders (customer_id null). Every customer email carries a link to
 * the public order page (/o/{token}) — appended in code so it survives any
 * template edits in the admin.
 */

const STATUS_TEMPLATE: Partial<Record<OrderStatus, string>> = {
  submitted: "order_confirmation",
  proof_ready: "proof_ready",
  changes_requested: "changes_requested",
  in_production: "in_production",
  approved: "in_production",
  shipped: "shipped",
  ready_for_pickup: "ready_for_pickup",
};

interface Template {
  subject: string;
  body: string;
}

function interpolate(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function resendClient(): { resend: Resend; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return null;
  return { resend: new Resend(apiKey), from };
}

/**
 * Send a templated email to the order's customer (profile email or guest
 * email). `extraVars` overlays the standard variable map. Fire-and-forget: all
 * failure modes log and return, never throw into the calling action.
 */
export async function sendOrderEmail(
  orderId: string,
  templateKey: string,
  extraVars: Record<string, string> = {}
): Promise<void> {
  const mail = resendClient();
  if (!mail) return; // not configured — skip silently

  const service = createSupabaseServiceClient();
  if (!service) return;

  const { data: order } = await service
    .from("orders")
    .select("order_number, customer_id, guest_email, shipping_tracking, public_token, pricing")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  let email = order.guest_email ?? null;
  let name: string | null = null;
  if (order.customer_id) {
    const { data: customer } = await service
      .from("profiles")
      .select("email, name, notification_preferences")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (!customer?.email) return;
    // Respect an explicit opt-out; default is opted-in. Guests are always sent
    // (transactional, and they have no preference record).
    const prefs = (customer.notification_preferences ?? {}) as unknown as Record<string, boolean>;
    if (prefs.email === false) return;
    email = customer.email;
    name = customer.name;
  }
  if (!email) return;

  const { data: setting } = await service
    .from("settings")
    .select("value")
    .eq("key", "email_templates")
    .maybeSingle();
  const templates = (setting?.value ?? {}) as unknown as Record<string, Template>;
  const tpl = templates[templateKey];
  if (!tpl) return;

  const { data: shipSetting } = await service.from("settings").select("value").eq("key", "shipping").maybeSingle();
  const pickupLocation =
    ((shipSetting?.value ?? {}) as unknown as { pickupLocation?: string }).pickupLocation ?? "the shop";

  const orderLink = await publicOrderUrl(order.public_token);
  const pricing = (order.pricing ?? {}) as { total?: number };

  const vars: Record<string, string> = {
    orderNumber: order.order_number ?? "",
    customerName: name ?? "there",
    trackingLine: order.shipping_tracking ? `Track it: ${order.shipping_tracking}` : "",
    pickupLocation,
    orderLink,
    totalDue: formatCAD(pricing.total ?? 0),
    ...extraVars,
  };

  try {
    await mail.resend.emails.send({
      from: mail.from,
      to: email,
      subject: interpolate(tpl.subject, vars),
      // The order link is appended in code so template edits can't lose it.
      text: `${interpolate(tpl.body, vars)}\n\nView your order: ${orderLink}`,
    });
  } catch (e) {
    // Never let a notification failure break the order action.
    console.error("[notify] order email failed", e);
  }
}

/** Status-change wrapper — maps the order status to its template (if any). */
export async function sendOrderStatusEmail(orderId: string, status: OrderStatus): Promise<void> {
  const templateKey = STATUS_TEMPLATE[status];
  if (!templateKey) return; // no email for this status
  await sendOrderEmail(orderId, templateKey);
}

/**
 * Internal notification to Julian (+ CC list) — proof decisions, payments.
 * Hardcoded copy on purpose: staff mail isn't customer-template territory.
 */
export async function notifyJulian(subject: string, text: string): Promise<void> {
  const mail = resendClient();
  const to = process.env.JULIAN_NOTIFY_EMAIL;
  if (!mail || !to) return;

  const cc = (process.env.NOTIFY_CC_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    await mail.resend.emails.send({
      from: mail.from,
      to: [to, ...cc],
      subject,
      text,
    });
  } catch (e) {
    console.error("[notify] staff email failed", e);
  }
}
