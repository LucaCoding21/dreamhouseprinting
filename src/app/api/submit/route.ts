import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  STORAGE_BUCKET,
  SUBMISSIONS_TABLE,
  getSupabaseAdmin,
} from "@/lib/supabase";
import type { QuoteFormData } from "@/lib/formTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow large multipart uploads (artwork files can be big).
export const maxDuration = 60;

type UploadedFile = { name: string; url: string; path: string };

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadFiles(
  submissionId: string,
  prefix: "artwork" | "price-match",
  files: File[],
): Promise<UploadedFile[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase || files.length === 0) return [];

  const results: UploadedFile[] = [];
  for (const file of files) {
    const path = `${submissionId}/${prefix}/${Date.now()}-${sanitizeFileName(
      file.name,
    )}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      console.error("[submit] storage upload failed", { path, error });
      continue;
    }
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 30); // 30-day link for Julian
    results.push({
      name: file.name,
      path,
      url: signed?.signedUrl ?? "",
    });
  }
  return results;
}

function renderEmailHtml(
  data: QuoteFormData,
  artwork: UploadedFile[],
  priceMatch: UploadedFile[],
) {
  const row = (label: string, value: string | number | undefined | null) =>
    value === undefined || value === null || value === ""
      ? ""
      : `<tr><td style="padding:6px 12px;color:#4a3f9e;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${label}</td><td style="padding:6px 12px;color:#1b1458;font-size:15px;">${String(
          value,
        )
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</td></tr>`;

  const fileList = (files: UploadedFile[]) =>
    files.length === 0
      ? '<span style="color:#8a7bff;">None</span>'
      : files
          .map(
            (f) =>
              `<div><a href="${f.url}" style="color:#7664ff;font-weight:600;">${f.name}</a></div>`,
          )
          .join("");

  return `<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;background:#afa6ff;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:2px solid #1b1458;border-radius:20px;overflow:hidden;">
    <div style="background:#7664ff;color:#ffffff;padding:20px 24px;">
      <h1 style="margin:0;font-size:24px;font-weight:800;">New Dreamhouse quote request</h1>
      <p style="margin:4px 0 0;opacity:0.9;font-size:14px;">${data.name} just submitted the form.</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        ${row("Name", data.name)}
        ${row("Email", data.email)}
        ${row("Phone", data.phone)}
        ${row("Referral", data.referralCode || "—")}
        <tr><td colspan="2" style="padding:8px 12px;"><hr style="border:none;border-top:1px solid #eee;"/></td></tr>
        ${row("Product", data.productType)}
        ${row("Color", data.garmentColor)}
        ${row("Quantity", data.quantity)}
        <tr><td colspan="2" style="padding:8px 12px;"><hr style="border:none;border-top:1px solid #eee;"/></td></tr>
        ${row("Print colors", data.printColors)}
        ${row("Print locations", data.printLocations.join(", "))}
        ${row("Print method", data.printMethod)}
        <tr><td colspan="2" style="padding:8px 12px;"><hr style="border:none;border-top:1px solid #eee;"/></td></tr>
        ${row("Needed by", data.neededBy || "—")}
        ${row("Design notes", data.designDescription || "—")}
        ${row("Other notes", data.notes || "—")}
      </tbody>
    </table>
    <div style="padding:16px 24px;border-top:1px solid #eee;">
      <p style="margin:0 0 6px;color:#4a3f9e;font-size:13px;font-weight:700;text-transform:uppercase;">Artwork files</p>
      ${fileList(artwork)}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #eee;">
      <p style="margin:0 0 6px;color:#4a3f9e;font-size:13px;font-weight:700;text-transform:uppercase;">Price match</p>
      ${fileList(priceMatch)}
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(
  data: QuoteFormData,
  artwork: UploadedFile[],
  priceMatch: UploadedFile[],
) {
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
      "[submit] Resend not configured — skipping email. Recipients:",
      recipients,
      "Key set:",
      !!apiKey,
    );
    return { skipped: true };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: `Dreamhouse Quotes <${from}>`,
    to: recipients,
    replyTo: data.email,
    subject: `New quote request — ${data.name} (${data.quantity}x ${data.productType})`,
    html: renderEmailHtml(data, artwork, priceMatch),
  });
  if (error) {
    console.error("[submit] Resend error", error);
    return { skipped: false, error: String(error) };
  }
  return { skipped: false };
}

function validatePayload(raw: unknown): QuoteFormData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  if (!str(o.name).trim() || !str(o.email).trim() || !str(o.phone).trim()) {
    return null;
  }
  return {
    name: str(o.name).trim(),
    email: str(o.email).trim(),
    phone: str(o.phone).trim(),
    referralCode: str(o.referralCode).trim(),
    productType: str(o.productType) as QuoteFormData["productType"],
    garmentColor: str(o.garmentColor).trim(),
    quantity: str(o.quantity).trim(),
    printColors: str(o.printColors),
    printLocations: arr(o.printLocations) as QuoteFormData["printLocations"],
    printMethod: (str(o.printMethod) || "not-sure") as QuoteFormData["printMethod"],
    designDescription: str(o.designDescription).trim(),
    neededBy: str(o.neededBy),
    notes: str(o.notes).trim(),
  };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const payloadRaw = form.get("payload");
    if (typeof payloadRaw !== "string") {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadRaw);
    } catch {
      return NextResponse.json({ error: "Bad payload JSON" }, { status: 400 });
    }

    const data = validatePayload(parsed);
    if (!data) {
      return NextResponse.json(
        { error: "Missing required contact fields" },
        { status: 400 },
      );
    }

    const artworkFiles = form
      .getAll("artwork")
      .filter((v): v is File => v instanceof File);
    const priceMatchFiles = form
      .getAll("priceMatch")
      .filter((v): v is File => v instanceof File);

    const supabase = getSupabaseAdmin();
    let submissionId = crypto.randomUUID();

    // If Supabase configured: insert row first to get the real ID, then upload files.
    if (supabase) {
      const { data: inserted, error: insertErr } = await supabase
        .from(SUBMISSIONS_TABLE)
        .insert({
          name: data.name,
          email: data.email,
          phone: data.phone,
          referral_code: data.referralCode || null,
          product_type: data.productType,
          garment_color: data.garmentColor,
          quantity: Number(data.quantity) || null,
          print_colors: data.printColors,
          print_locations: data.printLocations,
          print_method: data.printMethod,
          design_description: data.designDescription || null,
          needed_by: data.neededBy || null,
          notes: data.notes || null,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[submit] insert error", insertErr);
        return NextResponse.json(
          { error: "Could not save submission." },
          { status: 500 },
        );
      }
      submissionId = inserted.id as string;
    } else {
      console.log("[submit] Supabase not configured — logging submission:", {
        id: submissionId,
        data,
        artworkCount: artworkFiles.length,
        priceMatchCount: priceMatchFiles.length,
      });
    }

    const artwork = await uploadFiles(submissionId, "artwork", artworkFiles);
    const priceMatch = await uploadFiles(
      submissionId,
      "price-match",
      priceMatchFiles,
    );

    // Update row with file metadata if we have a real submission.
    if (supabase && (artwork.length > 0 || priceMatch.length > 0)) {
      const { error: updateErr } = await supabase
        .from(SUBMISSIONS_TABLE)
        .update({
          artwork_files: artwork,
          price_match_files: priceMatch,
        })
        .eq("id", submissionId);
      if (updateErr) {
        console.error("[submit] update file metadata failed", updateErr);
      }
    }

    await sendEmail(data, artwork, priceMatch);

    return NextResponse.json({ ok: true, id: submissionId });
  } catch (err) {
    console.error("[submit] unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
