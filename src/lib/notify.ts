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

/**
 * Per-template presentation: the CTA button label, and (for money emails) which
 * "amount card" to highlight above the button. Keyed by template key; anything
 * not listed falls back to a plain "View your order" button with no amount card.
 */
const EMAIL_CONFIG: Record<string, { cta: string; amountLabel?: string }> = {
  order_confirmation: { cta: "View your order" },
  // Approving leads straight to payment, so the proof email shows the total.
  proof_ready: { cta: "Review & approve your proof", amountLabel: "Total due" },
  changes_requested: { cta: "View your order" },
  in_production: { cta: "View your order" },
  shipped: { cta: "Track your order" },
  ready_for_pickup: { cta: "View pickup details" },
  invoice_sent: { cta: "Review & pay securely", amountLabel: "Total due" },
  payment_received: { cta: "View your order", amountLabel: "Amount paid" },
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
 * Resolve who a customer-facing order email goes to: the linked profile's email
 * (respecting an explicit email opt-out) or the guest email. Returns null when
 * there's no deliverable address or the customer opted out.
 */
async function resolveOrderRecipient(
  service: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  order: { customer_id: string | null; guest_email: string | null }
): Promise<{ email: string; name: string | null } | null> {
  if (order.customer_id) {
    const { data: customer } = await service
      .from("profiles")
      .select("email, name, notification_preferences")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (!customer?.email) return null;
    // Respect an explicit opt-out; default is opted-in.
    const prefs = (customer.notification_preferences ?? {}) as unknown as Record<string, boolean>;
    if (prefs.email === false) return null;
    return { email: customer.email, name: customer.name };
  }
  // Guests are always sent (transactional, no preference record).
  return order.guest_email ? { email: order.guest_email, name: null } : null;
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
    .select("order_number, customer_id, guest_email, shipping_tracking, public_token, pricing, customer_notes")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const recipient = await resolveOrderRecipient(service, order);
  if (!recipient) return;
  const { email, name } = recipient;

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

  const cfg = EMAIL_CONFIG[templateKey] ?? { cta: "View your order" };
  const heading = interpolate(tpl.subject, vars);
  const bodyText = interpolate(tpl.body, vars);

  // Customer-visible comments Julian added, included with the invoice email so
  // the thread the customer sees on their order page also reaches their inbox.
  // Only staff-authored customer-visible comments — never echo the customer's
  // own submitted note (actor "customer") back to them as if from us.
  const customerNotes =
    templateKey === "invoice_sent"
      ? ((order.customer_notes ?? []) as { at?: string; actor?: string; text?: string }[])
          .filter((n) => n.text?.trim() && n.actor !== "customer")
          .map((n) => n.text as string)
      : [];
  const notesText = customerNotes.length ? `\n\nNotes from us:\n${customerNotes.map((t) => `- ${t}`).join("\n")}` : "";

  try {
    await mail.resend.emails.send({
      from: mail.from,
      to: email,
      subject: heading,
      // Branded HTML + a plain-text alternative. The order link becomes a real
      // button (not a pasted URL) and is added in code so template edits can't
      // lose it; the text part keeps the raw link for text-only clients.
      html: renderOrderEmailHtml({
        heading,
        bodyText,
        orderLink,
        ctaLabel: cfg.cta,
        // Never render a $0 amount card (e.g. a proof sent before pricing is set).
        amount: cfg.amountLabel && (pricing.total ?? 0) > 0 ? { label: cfg.amountLabel, value: vars.totalDue } : null,
        notes: customerNotes,
      }),
      text: `${bodyText}${notesText}\n\nView your order: ${orderLink}`,
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
 * Notify the customer when Julian posts a customer-visible comment on their
 * order. The comment itself is the content (no admin-editable template needed),
 * shown in the shared branded shell's "note from Dreamhouse" card with the
 * usual public-order-page CTA. Fire-and-forget; never throws into the caller.
 */
export async function sendOrderCommentEmail(orderId: string, comment: string): Promise<void> {
  const trimmed = comment.trim();
  if (!trimmed) return;

  const mail = resendClient();
  if (!mail) return;

  const service = createSupabaseServiceClient();
  if (!service) return;

  const { data: order } = await service
    .from("orders")
    .select("order_number, customer_id, guest_email, public_token")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const recipient = await resolveOrderRecipient(service, order);
  if (!recipient) return;

  const orderLink = await publicOrderUrl(order.public_token);
  const orderNumber = order.order_number ?? "";
  const heading = `New update on your order${orderNumber ? ` ${orderNumber}` : ""}`;
  const bodyText = `Hi ${recipient.name ?? "there"}, we just added a note to your order. Here it is below — and you can always see the latest on your order page.`;

  try {
    await mail.resend.emails.send({
      from: mail.from,
      to: recipient.email,
      subject: heading,
      html: renderOrderEmailHtml({
        heading,
        bodyText,
        orderLink,
        ctaLabel: "View your order",
        notes: [trimmed],
      }),
      text: `${bodyText}\n\nNote from us:\n- ${trimmed}\n\nView your order: ${orderLink}`,
    });
  } catch (e) {
    console.error("[notify] order comment email failed", e);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn an admin-authored plain-text body into escaped HTML paragraphs. */
function bodyToParagraphs(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(
      (para) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a3468;">${escapeHtml(
          para
        ).replace(/\n/g, "<br />")}</p>`
    )
    .join("");
}

/**
 * Shared branded shell for customer-facing order emails (confirmation, proof,
 * invoice, shipped, …). Matches the home-page brand: lavender ground, white
 * rounded card, Archivo heading, sun-yellow amount card, a raised-purple CTA
 * button, and a footer with the business name + optional mailing address
 * (BUSINESS_ADDRESS env — a real postal address helps deliverability). The body
 * copy stays admin-editable plain text; this only wraps it, so template edits
 * can never break the layout.
 */
function renderOrderEmailHtml(opts: {
  heading: string;
  bodyText: string;
  orderLink: string;
  ctaLabel: string;
  amount?: { label: string; value: string } | null;
  notes?: string[];
}): string {
  const notesCard =
    opts.notes && opts.notes.length
      ? `<tr><td style="padding:4px 0 24px;">
      <div style="background:#eef0ff;border-radius:12px;padding:16px 20px;">
        <span style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#4a3f9e;margin:0 0 8px;">A note from Dreamhouse</span>
        ${opts.notes
          .map(
            (t) =>
              `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#1b1458;">${escapeHtml(t)}</p>`,
          )
          .join("")}
      </div>
    </td></tr>`
      : "";

  const amountCard = opts.amount
    ? `<tr><td style="padding:4px 0 24px;">
      <div style="background:#fff7d6;border-radius:12px;padding:16px 20px;">
        <span style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#4a3f9e;margin:0 0 4px;">${escapeHtml(
          opts.amount.label
        )}</span>
        <span style="display:block;font-family:Archivo,Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;color:#1b1458;">${escapeHtml(
          opts.amount.value
        )}</span>
      </div>
    </td></tr>`
    : "";

  const addr = process.env.BUSINESS_ADDRESS?.trim();
  const addressLine = addr ? `<br />${escapeHtml(addr)}` : "";

  return `
<div style="margin:0;padding:24px;background:#f4f1fb;font-family:Inter,Helvetica,Arial,sans-serif;color:#1b1458;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <tr><td style="font-family:Archivo,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;padding:0 0 16px;color:#1b1458;">${escapeHtml(
      opts.heading
    )}</td></tr>
    <tr><td>${bodyToParagraphs(opts.bodyText)}</td></tr>
    ${notesCard}
    ${amountCard}
    <tr><td style="padding:4px 0 24px;">
      <a href="${escapeHtml(
        opts.orderLink
      )}" style="display:inline-block;background:#7664ff;color:#ffffff;font-family:Archivo,Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:10px;">${escapeHtml(
        opts.ctaLabel
      )}</a>
    </td></tr>
    <tr><td style="font-size:13px;line-height:1.6;color:#8a84ad;">
      Or paste this link into your browser:<br />
      <a href="${escapeHtml(
        opts.orderLink
      )}" style="color:#7664ff;word-break:break-all;">${escapeHtml(opts.orderLink)}</a>
    </td></tr>
    <tr><td style="border-top:1px solid #eae7f7;margin-top:20px;padding:20px 0 0;font-size:12px;line-height:1.6;color:#8a84ad;">
      <strong style="color:#1b1458;">Dreamhouse Printing</strong><br />
      You're receiving this because you placed an order with us. Reply to this email if you need a hand.${addressLine}
    </td></tr>
  </table>
</div>`.trim();
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

/** Chip colours per event tone — soft background + strong text, from the dream palette. */
const STAFF_TONES = {
  purple: { bg: "#eef0ff", fg: "#4a3f9e" },
  success: { bg: "#e3f5ee", fg: "#18966a" },
  warn: { bg: "#fbeecd", fg: "#c98a16" },
} as const;

export interface StaffNotifyOpts {
  /** Attach order context: facts table (order / customer / total / status) + "Open in admin" button. */
  orderId?: string;
  /** Small uppercase event chip, e.g. "New order", "Proof approved". Defaults to "Update". */
  kicker?: string;
  tone?: keyof typeof STAFF_TONES;
  /** Render the order total as a highlighted amount card with this label (e.g. "Amount paid"). */
  amountLabel?: string;
}

/**
 * Branded shell for internal staff notifications — same visual family as the
 * customer emails (lavender ground, white card, Archivo-stack heading) but
 * admin-flavoured: an event chip, a key-facts table, and an "Open in admin"
 * button instead of the public order link. Table-based + inline styles for
 * Outlook/Gmail; copy is hardcoded on purpose (staff mail isn't
 * customer-template territory).
 */
function renderStaffEmailHtml(opts: {
  kicker: string;
  tone: keyof typeof STAFF_TONES;
  heading: string;
  bodyText: string;
  facts: { label: string; value: string }[];
  amount?: { label: string; value: string } | null;
  ctaUrl?: string | null;
}): string {
  const tone = STAFF_TONES[opts.tone];

  const factRows = opts.facts
    .map(
      (f, i) => `<tr>
        <td style="padding:${i === 0 ? "0" : "8px"} 16px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#8a84ad;white-space:nowrap;vertical-align:top;">${escapeHtml(f.label)}</td>
        <td style="padding:${i === 0 ? "0" : "8px"} 0 0;font-size:14px;line-height:1.5;color:#1b1458;vertical-align:top;">${escapeHtml(f.value)}</td>
      </tr>`
    )
    .join("");

  const factsCard = opts.facts.length
    ? `<tr><td style="padding:4px 0 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7fd;border-radius:12px;"><tr><td style="padding:16px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0">${factRows}</table>
      </td></tr></table>
    </td></tr>`
    : "";

  const amountCard = opts.amount
    ? `<tr><td style="padding:0 0 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7d6;border-radius:12px;"><tr><td style="padding:16px 20px;">
        <span style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#4a3f9e;margin:0 0 4px;">${escapeHtml(opts.amount.label)}</span>
        <span style="display:block;font-family:Archivo,Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;color:#1b1458;">${escapeHtml(opts.amount.value)}</span>
      </td></tr></table>
    </td></tr>`
    : "";

  const ctaBlock = opts.ctaUrl
    ? `<tr><td style="padding:0 0 24px;">
      <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:#7664ff;color:#ffffff;font-family:Archivo,Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:10px;">Open order in admin</a>
    </td></tr>`
    : "";

  return `
<div style="margin:0;padding:24px;background:#f4f1fb;font-family:Inter,Helvetica,Arial,sans-serif;color:#1b1458;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <tr><td style="padding:0 0 14px;">
      <span style="display:inline-block;background:${tone.bg};color:${tone.fg};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:5px 12px;border-radius:999px;">${escapeHtml(opts.kicker)}</span>
    </td></tr>
    <tr><td style="font-family:Archivo,Helvetica,Arial,sans-serif;font-size:21px;font-weight:700;line-height:1.3;padding:0 0 14px;color:#1b1458;">${escapeHtml(opts.heading)}</td></tr>
    <tr><td>${bodyToParagraphs(opts.bodyText)}</td></tr>
    ${factsCard}
    ${amountCard}
    ${ctaBlock}
    <tr><td style="border-top:1px solid #eae7f7;padding:16px 0 0;font-size:12px;line-height:1.6;color:#8a84ad;">
      Internal notification from your <strong style="color:#1b1458;">Dreamhouse Printing</strong> shop.
    </td></tr>
  </table>
</div>`.trim();
}

/**
 * Internal notification to Julian (+ CC list) — new orders, proof decisions,
 * payments. Pass `opts.orderId` to enrich the email with an order facts table
 * and an "Open order in admin" button; without opts it still gets the branded
 * staff shell around the plain text. The `text` argument stays the plain-text
 * alternative verbatim.
 */
export async function notifyJulian(subject: string, text: string, opts: StaffNotifyOpts = {}): Promise<void> {
  const mail = resendClient();
  const to = process.env.JULIAN_NOTIFY_EMAIL;
  if (!mail || !to) return;

  const cc = (process.env.NOTIFY_CC_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Order context (facts + CTA), best-effort — a lookup failure never blocks the send.
  const facts: { label: string; value: string }[] = [];
  let amount: { label: string; value: string } | null = null;
  let ctaUrl: string | null = null;
  if (opts.orderId) {
    try {
      const service = createSupabaseServiceClient();
      const { data: order } = service
        ? await service
            .from("orders")
            .select("order_number, status, pricing, customer_id, guest_email")
            .eq("id", opts.orderId)
            .maybeSingle()
        : { data: null };
      if (order) {
        let customer = order.guest_email ? `${order.guest_email} (guest)` : "";
        if (order.customer_id && service) {
          const { data: profile } = await service
            .from("profiles")
            .select("name, email")
            .eq("id", order.customer_id)
            .maybeSingle();
          if (profile) customer = [profile.name, profile.email].filter(Boolean).join(" · ");
        }
        const pricing = (order.pricing ?? {}) as { total?: number };
        if (order.order_number) facts.push({ label: "Order", value: order.order_number });
        if (customer) facts.push({ label: "Customer", value: customer });
        if (typeof pricing.total === "number" && pricing.total > 0) {
          facts.push({ label: "Total", value: formatCAD(pricing.total) });
          if (opts.amountLabel) amount = { label: opts.amountLabel, value: formatCAD(pricing.total) };
        }
        facts.push({ label: "Status", value: order.status.replace(/_/g, " ") });
        ctaUrl = `${await appOrigin()}/admin/orders/${opts.orderId}`;
      }
    } catch (e) {
      console.error("[notify] staff email order context failed", e);
    }
  }

  try {
    await mail.resend.emails.send({
      from: mail.from,
      to: [to, ...cc],
      subject,
      html: renderStaffEmailHtml({
        kicker: opts.kicker ?? "Update",
        tone: opts.tone ?? "purple",
        heading: subject,
        bodyText: text,
        facts,
        amount,
        ctaUrl,
      }),
      text: ctaUrl ? `${text}\n\nOpen order in admin: ${ctaUrl}` : text,
    });
  } catch (e) {
    console.error("[notify] staff email failed", e);
  }
}
