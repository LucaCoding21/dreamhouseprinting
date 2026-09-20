/**
 * Turn one image into a single-page, letter-size PDF in the browser, no
 * library. Julian prints mockups and proofs for the press, and a PDF prints
 * predictably from any machine where a loose PNG does not (browser print
 * dialogs scale/crop images unpredictably, and PDF is what his printer
 * expects). The page is composed on a canvas (title line, then the image
 * fitted inside the margins) and embedded as one JPEG, which needs only the
 * DCTDecode filter every PDF reader has supported since 1.2.
 *
 * Kept deliberately small: one image, one page, built-in orientation pick. If
 * this ever needs real text layout or multiple pages, reach for a library.
 */

const DPI = 200; // canvas pixels per PDF inch, sharp enough for a press sheet
const LETTER_IN = { w: 8.5, h: 11 };
const MARGIN_IN = 0.5;
const PT_PER_IN = 72;

export interface ImageSheetOptions {
  /** Line printed above the image, e.g. "Order #1119 · Jersey Tee, Black". */
  title?: string;
  /** Smaller second line, e.g. "Mockup · front". */
  subtitle?: string;
  /** JPEG quality 0..1 for the embedded page render. */
  quality?: number;
}

/** Render `image` (any Blob the browser can decode) into a letter-size PDF. */
export async function imageToPdfBlob(image: Blob, opts: ImageSheetOptions = {}): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  try {
    // Wide art goes on a landscape page so it is not shrunk to half the sheet.
    const landscape = bitmap.width > bitmap.height * 1.15;
    const pageIn = landscape ? { w: LETTER_IN.h, h: LETTER_IN.w } : LETTER_IN;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(pageIn.w * DPI);
    canvas.height = Math.round(pageIn.h * DPI);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const margin = MARGIN_IN * DPI;
    let top = margin;
    if (opts.title) {
      ctx.fillStyle = "#1b1458";
      ctx.font = `700 ${Math.round(0.2 * DPI)}px Archivo, Inter, Helvetica, Arial, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(fitText(ctx, opts.title, canvas.width - margin * 2), margin, top);
      top += Math.round(0.28 * DPI);
    }
    if (opts.subtitle) {
      ctx.fillStyle = "#6b6a80";
      ctx.font = `400 ${Math.round(0.14 * DPI)}px Inter, Helvetica, Arial, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(fitText(ctx, opts.subtitle, canvas.width - margin * 2), margin, top);
      top += Math.round(0.24 * DPI);
    }
    if (opts.title || opts.subtitle) top += Math.round(0.12 * DPI);

    // Fit the image inside what is left of the page, centred.
    const boxW = canvas.width - margin * 2;
    const boxH = canvas.height - margin - top;
    const scale = Math.min(boxW / bitmap.width, boxH / bitmap.height, 1e9);
    const drawW = bitmap.width * scale;
    const drawH = bitmap.height * scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, margin + (boxW - drawW) / 2, top + (boxH - drawH) / 2, drawW, drawH);

    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", opts.quality ?? 0.92);
    });
    const jpegBytes = new Uint8Array(await jpeg.arrayBuffer());
    return buildSingleImagePdf(jpegBytes, canvas.width, canvas.height, pageIn.w * PT_PER_IN, pageIn.h * PT_PER_IN);
  } finally {
    bitmap.close();
  }
}

/** Ellipsize `text` so it fits in `maxWidth` px with the current ctx font. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s + "…";
}

/** Minimal PDF 1.4 writer: one page, one JPEG XObject scaled to the page. */
function buildSingleImagePdf(jpeg: Uint8Array, imgW: number, imgH: number, pageW: number, pageH: number): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const beginObj = (n: number) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
  };

  push("%PDF-1.4\n%âãÏÓ\n");

  beginObj(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  beginObj(2);
  push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  beginObj(3);
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(pageW)} ${fmt(pageH)}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  beginObj(4);
  push(
    `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB ` +
      `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push("\nendstream\nendobj\n");
  const content = `q ${fmt(pageW)} 0 0 ${fmt(pageH)} 0 0 cm /Im0 Do Q`;
  beginObj(5);
  push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefAt = length;
  push("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
