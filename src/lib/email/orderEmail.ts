/**
 * The customer order email, as pure functions with no server imports, so the
 * real send (lib/notify.ts) and the Admin -> Settings preview render the exact
 * same HTML. Also the one list of which {{variables}} each template can use.
 */

/**
 * Per-template presentation: the CTA button label, and (for money emails) which
 * "amount card" to highlight above the button. Keyed by template key; anything
 * not listed falls back to a plain "View your order" button with no amount card.
 */
export const EMAIL_CONFIG: Record<string, { cta: string; amountLabel?: string }> = {
  order_confirmation: { cta: "View your order" },
  // Approving leads straight to payment, so the proof email shows the total.
  proof_ready: { cta: "Review & approve your proof", amountLabel: "Total due" },
  changes_requested: { cta: "View your order" },
  in_production: { cta: "View your order" },
  shipped: { cta: "Track your order" },
  ready_for_pickup: { cta: "View pickup details" },
  invoice_sent: { cta: "Review & pay securely", amountLabel: "Total due" },
  payment_received: { cta: "View your order", amountLabel: "Amount paid" },
  etransfer_reported: { cta: "View your order", amountLabel: "Amount sent" },
};

/** Swap {{name}} for its value. Unknown names become empty. */
export function interpolate(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

/** A variable an admin can drop into a template, with the sample used in the preview. */
export interface TemplateVariable {
  name: string;
  description: string;
  sample: string;
}

/** Available in every customer order email (built in `sendOrderEmail`). */
export const COMMON_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { name: "customerName", description: "Customer's name, or \"there\" when we don't have one", sample: "Sam" },
  { name: "orderNumber", description: "The order number", sample: "DH-2026-0042" },
  { name: "totalDue", description: "Order total, formatted like $412.50", sample: "$412.50" },
  { name: "orderLink", description: "Link to the customer's order page (the button already links there)", sample: "https://dreamhouseprinting.com/o/abc123" },
  { name: "trackingLine", description: "\"Track it: <number>\" once tracking is entered, otherwise blank", sample: "Track it: 1Z999AA10123456784" },
  { name: "pickupLocation", description: "Pickup location from the shipping settings", sample: "Vancouver, BC" },
  {
    name: "readyBy",
    description:
      "When it will be ready, as a sentence: the business-day rule before approval and payment, the real dates after. Added automatically to the confirmation, proof, payment and production emails when the template doesn't use it",
    sample: "Your order will be ready between Tue, Oct 20 and Mon, Oct 26.",
  },
];

/** Plain-language guide per template: when it sends, plus any extra variables. */
export const TEMPLATE_GUIDE: Record<string, { title: string; when: string; extra?: TemplateVariable[] }> = {
  order_confirmation: { title: "Order confirmation", when: "Sent when a customer places an order, or when you create one and tick the confirmation email." },
  proof_ready: { title: "Proof ready", when: "Sent when you click Send for approval. Shows the total due and an approve button." },
  changes_requested: { title: "Changes requested", when: "Sent when the order moves to Changes requested (the customer asked for edits on the proof)." },
  in_production: { title: "In production", when: "Sent when the order moves to Approved or In production." },
  shipped: { title: "Shipped", when: "Sent when the order moves to Shipped. Use {{trackingLine}} to include the tracking number." },
  ready_for_pickup: { title: "Ready for pickup", when: "Sent when the order moves to Ready for pickup." },
  invoice_sent: { title: "Payment link", when: "Sent when you click Email payment link. Also includes any customer messages on the order." },
  payment_received: { title: "Payment received", when: "Sent when a card payment goes through, or when you confirm an e-transfer arrived." },
  etransfer_reported: {
    title: "E-transfer reported",
    when: "Sent when the customer says they sent an e-transfer, before you confirm it.",
    extra: [{ name: "etransferEmail", description: "The e-transfer email from the payment settings", sample: "admin@dreamhouseprinting.com" }],
  },
};

export function variablesFor(templateKey: string): TemplateVariable[] {
  return [...COMMON_TEMPLATE_VARIABLES, ...(TEMPLATE_GUIDE[templateKey]?.extra ?? [])];
}

/** {{names}} used in the text that the template doesn't provide (they would send blank). */
export function unknownVariables(text: string, templateKey: string): string[] {
  const known = new Set(variablesFor(templateKey).map((v) => v.name));
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) if (!known.has(m[1])) found.add(m[1]);
  return [...found];
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn an admin-authored plain-text body into escaped HTML paragraphs. */
export function bodyToParagraphs(text: string): string {
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
 * (BUSINESS_ADDRESS env, passed in, a real postal address helps deliverability). The body
 * copy stays admin-editable plain text; this only wraps it, so template edits
 * can never break the layout.
 */
export function renderOrderEmailHtml(opts: {
  heading: string;
  bodyText: string;
  orderLink: string;
  ctaLabel: string;
  amount?: { label: string; value: string } | null;
  notes?: string[];
  /** Postal address for the footer (BUSINESS_ADDRESS env on the server). */
  businessAddress?: string | null;
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

  const addr = opts.businessAddress?.trim();
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
