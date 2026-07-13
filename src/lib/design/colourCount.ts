// In-house artwork colour counting for the designer (client-side only).
//
// Vectors (SVG, and PDFs whose drawing commands we can read) yield an EXACT
// count of distinct fill/stroke colours. Rasters yield a quantized ESTIMATE —
// and when the image is clearly photographic / continuous-tone we say "Full
// colour" instead of pretending an integer is meaningful. The artist confirms
// the real count at proofing either way; these numbers seed the estimate and
// the admin decoration spec, they never block ordering.

export type ColourAnalysis =
  | { kind: "exact"; colours: string[] } //   distinct colours, from vector source
  | { kind: "estimate"; colours: string[] } // quantized guess from a raster
  | { kind: "full" }; //                       photographic / continuous-tone

/** Above this many distinct colours we call it full colour — more than ~8
 *  screens is process/simulated-process territory, not spot colours. */
export const FULL_COLOUR_THRESHOLD = 8;

/** What a "full colour" job is priced as until the artist confirms: roughly a
 *  simulated-process screen count. Only affects methods with a per-colour cost. */
export const FULL_COLOUR_PRICING_COUNT = 6;

export function colourCountOf(a: ColourAnalysis): number | null {
  return a.kind === "full" ? null : a.colours.length;
}

/** Collapse an over-threshold exact/estimate into "full" for display + pricing. */
export function displayAnalysis(a: ColourAnalysis): ColourAnalysis {
  if (a.kind !== "full" && a.colours.length > FULL_COLOUR_THRESHOLD) return { kind: "full" };
  return a;
}

/** The colour count fed to the pricing engine. Estimates are provisional —
 *  the artist finalizes the count (and price) before anything is charged. */
export function pricingColourCount(a: ColourAnalysis): number {
  const d = displayAnalysis(a);
  if (d.kind === "full") return FULL_COLOUR_PRICING_COUNT;
  return Math.min(FULL_COLOUR_THRESHOLD, Math.max(1, d.colours.length));
}

/** Short chip label: "2 ink", "~4 ink", "Full colour". */
export function formatColourChip(a: ColourAnalysis, unit: "ink" | "thread"): string {
  const d = displayAnalysis(a);
  if (d.kind === "full") return "Full colour";
  const n = Math.max(1, d.colours.length);
  return `${d.kind === "estimate" ? "~" : ""}${n} ${unit}`;
}

/** Free-text value for the admin decoration spec sheet: "2", "~4", "Full colour". */
export function formatColourValue(a: ColourAnalysis): string {
  const d = displayAnalysis(a);
  if (d.kind === "full") return "Full colour";
  return `${d.kind === "estimate" ? "~" : ""}${Math.max(1, d.colours.length)}`;
}

/* ------------------------- colour normalization ------------------------- */

let normCtx: CanvasRenderingContext2D | null = null;

/** Resolve any CSS colour (named, #hex, rgb(), hsl()) to lowercase #rrggbb.
 *  Returns null for none/invisible values. Browser-only (uses a 2D context). */
export function normalizeCssColour(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v || v === "none" || v === "transparent" || v === "inherit" || v === "currentcolor") return null;
  if (v.startsWith("url(")) return null; // gradient/pattern ref — stops counted separately
  if (!normCtx) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    normCtx = c.getContext("2d", { willReadFrequently: true });
  }
  if (!normCtx) return null;
  normCtx.fillStyle = "#000000";
  normCtx.fillStyle = v;
  const out = normCtx.fillStyle; // browser-normalized: "#rrggbb" or "rgba(...)"
  if (out.startsWith("#")) return out;
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(out);
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) === 0) return null; // fully transparent
  const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

const rgbOf = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const dist = (a: [number, number, number], b: [number, number, number]) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

/** Dedupe a colour list, folding near-identical shades (antialiasing, export
 *  rounding) into one. `tolerance` is Euclidean RGB distance. */
function mergeSimilar(colours: string[], tolerance: number): string[] {
  const kept: { hex: string; rgb: [number, number, number] }[] = [];
  for (const hex of colours) {
    const rgb = rgbOf(hex);
    if (!kept.some((k) => dist(k.rgb, rgb) < tolerance)) kept.push({ hex, rgb });
  }
  return kept.map((k) => k.hex);
}

/* ------------------------------- vectors -------------------------------- */

/** Exact colour count from SVG source: fill/stroke attributes, style props,
 *  <style> blocks, and gradient stop-colors. */
export function analyzeSvgText(svg: string): ColourAnalysis {
  const found: string[] = [];
  const push = (raw: string | undefined | null) => {
    if (!raw) return;
    const hex = normalizeCssColour(raw);
    if (hex) found.push(hex);
  };
  // Attribute form: fill="…" stroke="…" stop-color="…"
  for (const m of svg.matchAll(/(?:fill|stroke|stop-color)\s*=\s*"([^"]*)"/gi)) push(m[1]);
  for (const m of svg.matchAll(/(?:fill|stroke|stop-color)\s*=\s*'([^']*)'/gi)) push(m[1]);
  // CSS form (style attributes and <style> blocks share the same syntax)
  for (const m of svg.matchAll(/(?:fill|stroke|stop-color)\s*:\s*([^;"'}]+)/gi)) push(m[1]);
  // SVG default: a shape with no fill anywhere paints black.
  if (found.length === 0 && /<(path|rect|circle|ellipse|polygon|polyline|text)\b/i.test(svg)) {
    found.push("#000000");
  }
  return { kind: "exact", colours: mergeSimilar(found, 8) };
}

/** Exact colour count from a PDF's drawing commands (fills/strokes). Returns
 *  null when the page paints raster images or uses colour spaces we can't
 *  resolve — the caller should fall back to a raster estimate of the render. */
export async function analyzePdfColours(file: File): Promise<ColourAnalysis | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    try {
      const page = await pdf.getPage(1);
      const ops = await page.getOperatorList();
      const OPS = pdfjs.OPS;
      const colours: string[] = [];
      let sawText = false;
      const toHex = (r: number, g: number, b: number) => {
        // pdf.js emits 0..255 components; be defensive about 0..1 encoders.
        const s = r <= 1 && g <= 1 && b <= 1 ? 255 : 1;
        const h = (n: number) =>
          Math.max(0, Math.min(255, Math.round(n * s)))
            .toString(16)
            .padStart(2, "0");
        return `#${h(r)}${h(g)}${h(b)}`;
      };
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i] as unknown[];
        if (fn === OPS.setFillRGBColor || fn === OPS.setStrokeRGBColor) {
          const [r, g, b] = args as number[];
          colours.push(toHex(r, g, b));
        } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
          return null; // embedded raster — colours live in pixels, not commands
        } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
          sawText = true;
        }
      }
      if (colours.length === 0) {
        // Nothing drawable we could read (unsupported colour space, etc.) —
        // unless it's a pure-text PDF, which defaults to black.
        if (!sawText) return null;
        colours.push("#000000");
      }
      return { kind: "exact", colours: mergeSimilar(colours, 8) };
    } finally {
      pdf.destroy();
    }
  } catch {
    return null;
  }
}

/* ------------------------------- rasters -------------------------------- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}

/**
 * Quantized estimate for a raster. Samples the image at ≤128px, buckets opaque
 * pixels, keeps buckets covering a meaningful share, merges near-identical
 * shades. Photographic / continuous-tone images (many distinct buckets, or no
 * small set of dominant colours) come back as "full".
 */
export async function analyzeRasterDataUrl(src: string): Promise<ColourAnalysis> {
  const img = await loadImage(src);
  const scale = Math.min(1, 128 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { kind: "full" };
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  // Bucket at 16 levels/channel; tally opaque pixels only.
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let opaque = 0;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a < 32) continue;
    opaque++;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bkt = buckets.get(key);
    if (bkt) {
      bkt.n++;
      bkt.r += r;
      bkt.g += g;
      bkt.b += b;
    } else buckets.set(key, { n: 1, r, g, b });
  }
  if (opaque === 0) return { kind: "estimate", colours: [] };

  // A photo/gradient scatters across hundreds of buckets — call it early.
  if (buckets.size > 200) return { kind: "full" };

  // Dominant buckets: ≥1.5% of opaque pixels (antialiasing fringe drops out).
  const dominant = [...buckets.values()]
    .filter((bkt) => bkt.n / opaque >= 0.015)
    .sort((a, b) => b.n - a.n);
  // If the dominant set covers little of the image, tone is continuous → full.
  const coverage = dominant.reduce((s, bkt) => s + bkt.n, 0) / opaque;
  if (dominant.length === 0 || coverage < 0.6) return { kind: "full" };

  const hexes = dominant.map((bkt) => {
    const hx = (n: number) => Math.round(n / bkt.n).toString(16).padStart(2, "0");
    return `#${hx(bkt.r)}${hx(bkt.g)}${hx(bkt.b)}`;
  });
  const merged = mergeSimilar(hexes, 48);
  // Raster estimates get a tighter cutoff than vectors: a flat-colour logo
  // export rarely exceeds ~6 inks, so more than that is continuous tone.
  if (merged.length > 6) return { kind: "full" };
  return { kind: "estimate", colours: merged };
}

/* ------------------------------ dispatcher ------------------------------ */

/** Analyze any image source the canvas can hold: SVG data URLs get the exact
 *  vector parse, everything else (raster data URLs, hosted URLs) the estimate. */
export async function analyzeImageSource(src: string): Promise<ColourAnalysis> {
  try {
    if (src.startsWith("data:image/svg+xml")) {
      const [head, body] = [src.slice(0, src.indexOf(",")), src.slice(src.indexOf(",") + 1)];
      const text = head.includes("base64") ? atob(body) : decodeURIComponent(body);
      return analyzeSvgText(text);
    }
    if (/\.svg([?#]|$)/i.test(src)) {
      // Hosted SVG — fetch the source for an exact parse; fall back to raster.
      try {
        const res = await fetch(src);
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("svg")) return analyzeSvgText(await res.text());
      } catch {
        /* fall through to raster */
      }
    }
    return await analyzeRasterDataUrl(src);
  } catch {
    // Unreadable (CORS, bad data) — an honest "we don't know".
    return { kind: "full" };
  }
}

/** Combine the analyses of every object on one decorated side. */
export function mergeAnalyses(list: ColourAnalysis[]): ColourAnalysis {
  if (list.length === 0) return { kind: "exact", colours: [] };
  if (list.some((a) => a.kind === "full")) return { kind: "full" };
  const all = mergeSimilar(list.flatMap((a) => (a.kind === "full" ? [] : a.colours)), 8);
  const exact = list.every((a) => a.kind === "exact");
  return exact ? { kind: "exact", colours: all } : { kind: "estimate", colours: all };
}
