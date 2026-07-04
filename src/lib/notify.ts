import "server-only";

import { Resend } from "resend";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { publicOrderUrl, appOrigin } from "@/lib/orders/publicLink";
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Confirmation email for a guest who saved a design in the designer. Fired once,
 * when the design row is first created (the "Name your design" modal promises
 * "That's where we'll send your proof"). The Resume link restores their guest
 * cookie on any device, so the design opens even from a fresh browser. Degrades
 * to a no-op when Resend isn't configured. Never throws into the caller.
 */
export async function sendDesignSavedEmail(opts: {
  to: string;
  designName: string;
  productName: string;
  designId: string;
  guestToken: string;
  mockupUrl?: string | null;
}): Promise<void> {
  const mail = resendClient();
  if (!mail) {
    console.log("[notify] design-saved email skipped (Resend unconfigured):", opts.to);
    return;
  }

  const origin = await appOrigin();
  const resumeUrl = `${origin}/design/resume/${opts.designId}?t=${encodeURIComponent(opts.guestToken)}`;
  const name = escapeHtml(opts.designName);
  const product = escapeHtml(opts.productName);

  const mockupBlock = opts.mockupUrl
    ? `<tr><td style="padding:0 0 24px;"><img src="${escapeHtml(opts.mockupUrl)}" alt="${name}" width="240" style="display:block;max-width:100%;height:auto;border-radius:12px;border:1px solid #eae7f7;" /></td></tr>`
    : "";

  const html = `
<div style="margin:0;padding:24px;background:#f4f1fb;font-family:Inter,Helvetica,Arial,sans-serif;color:#1b1458;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <tr><td style="font-family:Archivo,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;padding:0 0 12px;">Your design is saved${name ? ` — “${name}”` : ""}</td></tr>
    <tr><td style="font-size:15px;line-height:1.6;padding:0 0 20px;color:#3a3468;">
      Nice work! We saved your <strong>${product}</strong> design so you can pick up right where you left off. When you're ready, come back and finish — that's where we'll send your proof to approve before anything prints.
    </td></tr>
    ${mockupBlock}
    <tr><td style="padding:0 0 24px;">
      <a href="${resumeUrl}" style="display:inline-block;background:#7664ff;color:#ffffff;font-family:Archivo,Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:10px;">Resume your design</a>
    </td></tr>
    <tr><td style="font-size:13px;line-height:1.6;color:#8a84ad;">
      Or paste this link into your browser:<br />
      <a href="${resumeUrl}" style="color:#7664ff;word-break:break-all;">${resumeUrl}</a>
    </td></tr>
    <tr><td style="font-size:13px;line-height:1.6;color:#8a84ad;padding:20px 0 0;">— Dreamhouse Printing</td></tr>
  </table>
</div>`.trim();

  const text = `Your design is saved${opts.designName ? ` — "${opts.designName}"` : ""}!

We saved your ${opts.productName} design so you can pick up right where you left off. Finish when you're ready — that's where we'll send your proof to approve before anything prints.

Resume your design: ${resumeUrl}

— Dreamhouse Printing`;

  try {
    await mail.resend.emails.send({
      from: mail.from,
      to: opts.to,
      subject: `Your ${opts.productName} design is saved`,
      html,
      text,
    });
  } catch (e) {
    console.error("[notify] design-saved email failed", e);
  }
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
