import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  STORAGE_BUCKET,
  SUBMISSIONS_TABLE,
  getSupabaseAdmin,
} from "@/lib/supabase";
import {
  PRINT_LOCATION_LABEL,
  SIZE_KEYS,
  type GarmentBrand,
  type PrintLocation,
  type PrintPlacement,
  type QuoteFormData,
  type SizeBreakdown,
  type SizeKey,
} from "@/lib/formTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type UploadedFile = { name: string; url: string; path: string };

// Snapshot of the on-screen estimate the customer saw (sent by the client).
type QuoteEstimate = {
  available: boolean;
  product: string;
  sku: string | null;
  decoration: "screen" | "embroidery" | null;
  colors: number | null;
  locations: number | null;
  placements: { location: string; label: string; colors: number | null }[];
  quantity: number;
  perUnit: number;
  total: number;
};

function parseEstimate(raw: unknown): QuoteEstimate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    available: o.available === true,
    product: typeof o.product === "string" ? o.product : "Custom",
    sku: typeof o.sku === "string" ? o.sku : null,
    decoration:
      o.decoration === "screen" || o.decoration === "embroidery"
        ? o.decoration
        : null,
    colors: typeof o.colors === "number" ? o.colors : null,
    locations: typeof o.locations === "number" ? o.locations : null,
    placements: Array.isArray(o.placements)
      ? o.placements.flatMap((p) => {
          if (!p || typeof p !== "object") return [];
          const q = p as Record<string, unknown>;
          const location = typeof q.location === "string" ? q.location : "";
          if (!location) return [];
          return [
            {
              location,
              label: typeof q.label === "string" ? q.label : location,
              colors: typeof q.colors === "number" ? q.colors : null,
            },
          ];
        })
      : [],
    quantity: num(o.quantity),
    perUnit: num(o.perUnit),
    total: num(o.total),
  };
}

// Files are uploaded straight from the browser to Supabase Storage (see
// /api/upload-url). The client sends us the resulting {name, path} pairs; here
// we just mint a 30-day signed download link per path for Julian's email.
type UploadedRef = { name: string; path: string };

function parseUploadedRefs(raw: unknown, prefix: "artwork" | "price-match"): UploadedRef[] {
  if (!Array.isArray(raw)) return [];
  const refs: UploadedRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "file";
    const path = typeof o.path === "string" ? o.path : "";
    // Only accept paths shaped like {uuid}/{prefix}/... and never with `..`.
    if (!path || path.includes("..")) continue;
    if (!path.includes(`/${prefix}/`)) continue;
    refs.push({ name, path });
  }
  return refs;
}

async function signUploaded(refs: UploadedRef[]): Promise<UploadedFile[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase || refs.length === 0) return [];

  const results: UploadedFile[] = [];
  for (const ref of refs) {
    const { data: signed, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(ref.path, 60 * 60 * 24 * 30); // 30-day link for Julian
    if (error || !signed) {
      console.error("[submit] could not sign uploaded file", { path: ref.path, error });
      continue;
    }
    results.push({ name: ref.name, path: ref.path, url: signed.signedUrl });
  }
  return results;
}

function renderEmailHtml(
  data: QuoteFormData,
  artwork: UploadedFile[],
  priceMatch: UploadedFile[],
  estimate: QuoteEstimate | null,
) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const row = (label: string, value: string | number | undefined | null) =>
    value === undefined || value === null || value === ""
      ? ""
      : `<tr><td style="padding:6px 12px;color:#4a3f9e;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${label}</td><td style="padding:6px 12px;color:#1b1458;font-size:15px;">${esc(
          String(value),
        )}</td></tr>`;

  const fileList = (files: UploadedFile[]) =>
    files.length === 0
      ? '<span style="color:#8a7bff;">None</span>'
      : files
          .map(
            (f) =>
              `<div><a href="${f.url}" style="color:#7664ff;font-weight:600;">${esc(f.name)}</a></div>`,
          )
          .join("");

  const brandLabel =
    data.garmentBrand === "gildan"
      ? "Gildan (budget)"
      : data.garmentBrand === "bella-canvas"
        ? "Bella+Canvas (mid)"
        : data.garmentBrand === "comfort-colors"
          ? "Comfort Colors (premium)"
          : data.garmentBrand === "no-preference"
            ? "No preference — Julian picks"
            : "";

  const sizesEntries = (Object.keys(data.sizes) as SizeKey[])
    .filter((k) => SIZE_KEYS.includes(k))
    .sort((a, b) => SIZE_KEYS.indexOf(a) - SIZE_KEYS.indexOf(b))
    .map((k) => `${k}: ${data.sizes[k]}`);
  const sizesLine = sizesEntries.length
    ? sizesEntries.join(" · ")
    : data.sizesLater
      ? "Will provide later"
      : "—";

  // Per-location print breakdown — each spot and its own colour count, so
  // Julian can quote every location instead of guessing from one global number.
  const isEmbroidery = data.printMethod === "embroidery";
  const placementsHtml = data.placements.length
    ? data.placements
        .map((p) => {
          const label = PRINT_LOCATION_LABEL[p.location] ?? p.location;
          const detail = isEmbroidery
            ? "Embroidery"
            : `${p.colors >= 5 ? "5+" : p.colors} colour${p.colors === 1 ? "" : "s"}`;
          return `<div style="padding:2px 0;color:#1b1458;font-size:15px;"><strong>${esc(label)}</strong> — ${esc(detail)}</div>`;
        })
        .join("")
    : // Fallback to the legacy flat fields if an old client somehow omits placements.
      `<div style="color:#1b1458;font-size:15px;">${esc(
        [data.printColors && `${data.printColors} colours`, data.printLocations.join(", ")]
          .filter(Boolean)
          .join(" · ") || "—",
      )}</div>`;

  const priceMatchLinkHtml = data.priceMatchLink
    ? `<div><a href="${esc(data.priceMatchLink)}" style="color:#7664ff;font-weight:600;word-break:break-all;">${esc(data.priceMatchLink)}</a></div>`
    : "";
  const priceMatchFilesHtml = fileList(priceMatch);
  const priceMatchBody =
    priceMatchLinkHtml || priceMatch.length > 0
      ? `${priceMatchLinkHtml}${priceMatch.length > 0 ? priceMatchFilesHtml : ""}`
      : '<span style="color:#8a7bff;">None</span>';

  // Quote estimate box — the price the customer saw, plus the "why" breakdown.
  let estimateHtml = "";
  if (estimate && estimate.available) {
    const decoLabel =
      estimate.decoration === "embroidery" ? "Embroidery" : "Screen print";
    const parts = [
      `${estimate.quantity} × ${esc(estimate.product)}`,
      decoLabel,
    ];
    if (estimate.decoration === "screen" && estimate.colors)
      parts.push(`${estimate.colors} colour${estimate.colors === 1 ? "" : "s"}`);
    parts.push(
      `${estimate.locations ?? 1} location${(estimate.locations ?? 1) === 1 ? "" : "s"}`,
    );
    estimateHtml = `
    <div style="padding:18px 24px;background:#fff7d6;border-bottom:1px solid #eee;">
      <p style="margin:0 0 4px;color:#4a3f9e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Quote shown to customer</p>
      <p style="margin:0;color:#1b1458;font-size:24px;font-weight:800;">$${estimate.perUnit.toLocaleString()} / item &nbsp;·&nbsp; $${estimate.total.toLocaleString()} total</p>
      <p style="margin:6px 0 0;color:#4a3f9e;font-size:14px;">${esc(parts.join(" · "))}</p>
      <p style="margin:8px 0 0;color:#8a7bff;font-size:11px;">This is our best guess at the pricing for your order. We will review everything and get you back a final quote asap!</p>
    </div>`;
  } else {
    estimateHtml = `
    <div style="padding:18px 24px;background:#fff7d6;border-bottom:1px solid #eee;">
      <p style="margin:0 0 4px;color:#4a3f9e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Quote shown to customer</p>
      <p style="margin:0;color:#1b1458;font-size:16px;font-weight:700;">No auto-estimate — custom item, needs a manual quote.</p>
    </div>`;
  }

  return `<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;background:#afa6ff;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:2px solid #1b1458;border-radius:20px;overflow:hidden;">
    <div style="background:#7664ff;color:#ffffff;padding:20px 24px;">
      <h1 style="margin:0;font-size:24px;font-weight:800;">New Dreamhouse quote request</h1>
      <p style="margin:4px 0 0;opacity:0.9;font-size:14px;">${esc(data.name)} just submitted the form.</p>
    </div>
    ${estimateHtml}
    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        ${row("Name", data.name)}
        ${row("Email", data.email)}
        ${row("Phone", data.phone)}
        ${row("Referral", data.referralCode || "—")}
        ${row("Found us via", data.heardAbout || "—")}
        <tr><td colspan="2" style="padding:8px 12px;"><hr style="border:none;border-top:1px solid #eee;"/></td></tr>
        ${row("Product", data.productType)}
        ${row("Brand tier", brandLabel || "—")}
        ${row("Color", data.garmentColor)}
        ${row("Quantity", data.quantity)}
        ${row("Sizes", sizesLine)}
        <tr><td colspan="2" style="padding:8px 12px;"><hr style="border:none;border-top:1px solid #eee;"/></td></tr>
        <tr><td style="padding:6px 12px;color:#4a3f9e;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;" valign="top">Print detail</td><td style="padding:6px 12px;">${placementsHtml}</td></tr>
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
      ${priceMatchBody}
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(
  data: QuoteFormData,
  artwork: UploadedFile[],
  priceMatch: UploadedFile[],
  estimate: QuoteEstimate | null,
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
    html: renderEmailHtml(data, artwork, priceMatch, estimate),
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
  const bool = (v: unknown) => v === true;
  const placementsIn = (v: unknown): PrintPlacement[] => {
    if (!Array.isArray(v)) return [];
    const out: PrintPlacement[] = [];
    for (const item of v) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const location = str(o.location).trim();
      if (!location) continue;
      const c = typeof o.colors === "number" && Number.isFinite(o.colors) ? o.colors : 1;
      out.push({
        location: location as PrintLocation,
        colors: Math.max(1, Math.min(5, Math.floor(c))),
      });
    }
    return out;
  };
  const sizesIn = (v: unknown): SizeBreakdown => {
    if (!v || typeof v !== "object") return {};
    const src = v as Record<string, unknown>;
    const out: SizeBreakdown = {};
    for (const k of SIZE_KEYS) {
      const raw = str(src[k]).trim();
      const n = Number(raw);
      if (raw && Number.isFinite(n) && n > 0) out[k] = String(Math.floor(n));
    }
    return out;
  };

  if (!str(o.name).trim() || !str(o.email).trim() || !str(o.phone).trim()) {
    return null;
  }
  return {
    name: str(o.name).trim(),
    email: str(o.email).trim(),
    phone: str(o.phone).trim(),
    referralCode: str(o.referralCode).trim(),
    productType: str(o.productType) as QuoteFormData["productType"],
    garmentBrand: str(o.garmentBrand) as GarmentBrand | "",
    garmentColor: str(o.garmentColor).trim(),
    sizes: sizesIn(o.sizes),
    sizesLater: bool(o.sizesLater),
    quantity: str(o.quantity).trim(),
    placements: placementsIn(o.placements),
    printColors: str(o.printColors),
    printLocations: arr(o.printLocations) as QuoteFormData["printLocations"],
    printMethod: (str(o.printMethod) || "not-sure") as QuoteFormData["printMethod"],
    designDescription: str(o.designDescription).trim(),
    neededBy: str(o.neededBy),
    notes: str(o.notes).trim(),
    priceMatchLink: str(o.priceMatchLink).trim(),
    heardAbout: str(o.heardAbout).trim(),
  };
}

export async function POST(request: Request) {
  try {
    // Body is small JSON now — files were uploaded straight to Storage from the
    // browser (see /api/upload-url), so we only receive their {name, path}.
    let body: Record<string, unknown>;
    try {
      const json = await request.json();
      body = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
    } catch {
      return NextResponse.json({ error: "Bad payload JSON" }, { status: 400 });
    }

    const data = validatePayload(body.payload);
    if (!data) {
      return NextResponse.json(
        { error: "Missing required contact fields" },
        { status: 400 },
      );
    }

    // Optional estimate snapshot (the price the customer saw). Best-effort.
    const estimate: QuoteEstimate | null = parseEstimate(body.estimate);

    const artworkRefs = parseUploadedRefs(body.artwork, "artwork");
    const priceMatchRefs = parseUploadedRefs(body.priceMatch, "price-match");

    const supabase = getSupabaseAdmin();
    let submissionId = crypto.randomUUID();

    // If Supabase configured: insert row first to get the real ID, then upload files.
    if (supabase) {
      const hasSizes = Object.keys(data.sizes).length > 0;
      const { data: inserted, error: insertErr } = await supabase
        .from(SUBMISSIONS_TABLE)
        .insert({
          name: data.name,
          email: data.email,
          phone: data.phone,
          referral_code: data.referralCode || null,
          product_type: data.productType,
          garment_brand: data.garmentBrand || null,
          garment_color: data.garmentColor,
          sizes: hasSizes ? data.sizes : null,
          quantity: Number(data.quantity) || null,
          print_colors: data.printColors,
          print_locations: data.printLocations,
          print_method: data.printMethod,
          design_description: data.designDescription || null,
          needed_by: data.neededBy || null,
          notes: data.notes || null,
          price_match_link: data.priceMatchLink || null,
          heard_about: data.heardAbout || null,
          estimated_per_unit: estimate?.available ? estimate.perUnit : null,
          estimated_total: estimate?.available ? estimate.total : null,
          quote_estimate: estimate ?? null,
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
        artworkCount: artworkRefs.length,
        priceMatchCount: priceMatchRefs.length,
      });
    }

    const artwork = await signUploaded(artworkRefs);
    const priceMatch = await signUploaded(priceMatchRefs);

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

    await sendEmail(data, artwork, priceMatch, estimate);

    return NextResponse.json({ ok: true, id: submissionId });
  } catch (err) {
    console.error("[submit] unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
