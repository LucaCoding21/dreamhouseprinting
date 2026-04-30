import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactPayload = {
  name: string;
  email: string;
  message: string;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(data: ContactPayload) {
  const messageHtml = escapeHtml(data.message).replace(/\n/g, "<br/>");
  return `<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;background:#afa6ff;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:2px solid #1b1458;border-radius:20px;overflow:hidden;">
    <div style="background:#7664ff;color:#ffffff;padding:20px 24px;">
      <h1 style="margin:0;font-size:22px;font-weight:800;">New message from the contact form</h1>
      <p style="margin:4px 0 0;opacity:0.9;font-size:14px;">${escapeHtml(data.name)} wrote in.</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        <tr><td style="padding:10px 16px;color:#4a3f9e;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Name</td><td style="padding:10px 16px;color:#1b1458;font-size:15px;">${escapeHtml(data.name)}</td></tr>
        <tr><td style="padding:10px 16px;color:#4a3f9e;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Email</td><td style="padding:10px 16px;color:#1b1458;font-size:15px;"><a href="mailto:${escapeHtml(data.email)}" style="color:#7664ff;font-weight:600;">${escapeHtml(data.email)}</a></td></tr>
      </tbody>
    </table>
    <div style="padding:16px 24px;border-top:1px solid #eee;">
      <p style="margin:0 0 8px;color:#4a3f9e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
      <div style="color:#1b1458;font-size:15px;line-height:1.55;">${messageHtml}</div>
    </div>
  </div>
</body>
</html>`;
}

function validate(raw: unknown): ContactPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(o.name);
  const email = str(o.email);
  const message = str(o.message);
  if (!name || !email || !message) return null;
  if (!/^\S+@\S+\.\S+$/.test(email)) return null;
  return { name, email, message };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = validate(body);
    if (!data) {
      return NextResponse.json(
        { error: "Please fill out all fields with a valid email." },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const primary = process.env.JULIAN_NOTIFY_EMAIL;
    const cc = (process.env.NOTIFY_CC_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const recipients = [primary, ...cc].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );

    if (!apiKey || recipients.length === 0) {
      console.log(
        "[contact] Resend not configured — logging submission:",
        data,
        "Recipients:",
        recipients,
        "Key set:",
        !!apiKey,
      );
      return NextResponse.json({ ok: true, skipped: true });
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `Dreamhouse Contact <${from}>`,
      to: recipients,
      replyTo: data.email,
      subject: `New contact message — ${data.name}`,
      html: renderHtml(data),
    });

    if (error) {
      console.error("[contact] Resend error", error);
      return NextResponse.json(
        { error: "Could not send right now. Try again in a sec." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
