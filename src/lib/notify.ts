import "server-only";

import { Resend } from "resend";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { OrderStatus } from "@/lib/db/rows";

/**
 * Transactional order notifications (PRD §10.1). The SAME status change that
 * advances the tracker triggers the email — one event, both effects. Templates
 * live in the `settings` row keyed 'email_templates' (editable in Admin →
 * Settings); the customer's notification_preferences gate delivery. Degrades to
 * a no-op when Resend isn't configured (local dev).
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

export async function sendOrderStatusEmail(orderId: string, status: OrderStatus): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return; // not configured — skip silently

  const templateKey = STATUS_TEMPLATE[status];
  if (!templateKey) return; // no email for this status

  const service = createSupabaseServiceClient();
  if (!service) return;

  const { data: order } = await service
    .from("orders")
    .select("order_number, customer_id, shipping_tracking")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.customer_id) return;

  const { data: customer } = await service
    .from("profiles")
    .select("email, name, notification_preferences")
    .eq("id", order.customer_id)
    .maybeSingle();
  if (!customer?.email) return;

  // Respect an explicit opt-out; default is opted-in.
  const prefs = (customer.notification_preferences ?? {}) as unknown as Record<string, boolean>;
  if (prefs.email === false) return;

  const { data: setting } = await service
    .from("settings")
    .select("value")
    .eq("key", "email_templates")
    .maybeSingle();
  const templates = (setting?.value ?? {}) as unknown as Record<string, Template>;
  const tpl = templates[templateKey];
  if (!tpl) return;

  const { data: shopSetting } = await service.from("settings").select("value").eq("key", "shop").maybeSingle();
  const { data: shipSetting } = await service.from("settings").select("value").eq("key", "shipping").maybeSingle();
  const pickupLocation = ((shipSetting?.value ?? {}) as unknown as { pickupLocation?: string }).pickupLocation ?? "the shop";

  const vars: Record<string, string> = {
    orderNumber: order.order_number ?? "",
    customerName: customer.name ?? "there",
    trackingLine: order.shipping_tracking ? `Track it: ${order.shipping_tracking}` : "",
    pickupLocation,
  };
  void shopSetting;

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from,
      to: customer.email,
      subject: interpolate(tpl.subject, vars),
      text: interpolate(tpl.body, vars),
    });
  } catch (e) {
    // Never let a notification failure break the order action.
    console.error("[notify] order status email failed", e);
  }
}
