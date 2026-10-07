/**
 * Browser-side PDF rasterizing for previews: proof thumbnails, the full-size
 * viewers and the admin artwork sheet. Proofs are usually PDFs, and a PDF
 * can't go in an <img>, so before this every one of them showed as a generic
 * document glyph (Julian: "the PDF does not show in the icon").
 *
 * Client only (uses document + canvas). pdf.js is loaded lazily on first use,
 * with the same bundled worker the designer upload path uses, and ONE shared
 * PDFWorker for every document so a page of thumbnails doesn't spin up a
 * worker per file. Fetched bytes and rendered thumbnails are cached for the
 * page's lifetime, so a proof that shows on its line, in the proof panel and
 * in the history strip is downloaded and rendered once.
 */

type Pdfjs = typeof import("pdfjs-dist");
export type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;

let lib: Promise<{ pdfjs: Pdfjs; worker: InstanceType<Pdfjs["PDFWorker"]> }> | null = null;

function loadPdfjs() {
  if (!lib) {
    lib = import("pdfjs-dist").then((pdfjs) => {
      // Bundled worker (offline-safe, version-matched), resolved by Turbopack.
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return { pdfjs, worker: new pdfjs.PDFWorker() };
    });
    // A failed chunk load shouldn't poison every later preview.
    lib.catch(() => {
      lib = null;
    });
  }
  return lib;
}

const bytesCache = new Map<string, Promise<Uint8Array>>();

/** Signed Storage URLs (CORS *), blob: object URLs and data: URLs all fetch. */
function fetchBytes(src: string): Promise<Uint8Array> {
  let p = bytesCache.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`fetch ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => new Uint8Array(b));
    bytesCache.set(src, p);
    p.catch(() => bytesCache.delete(src));
  }
  return p;
}

/** Parse a PDF. The caller owns the result and must destroy() it. */
export async function openPdf(src: string): Promise<PdfDoc> {
  const [{ pdfjs, worker }, bytes] = await Promise.all([loadPdfjs(), fetchBytes(src)]);
  // pdf.js transfers the buffer to the worker (detaching it), so hand it a
  // copy and keep the cached bytes intact for the next open.
  return pdfjs.getDocument({ data: bytes.slice(), worker }).promise;
}

/** Hard ceiling on one rendered page, in pixels, so a poster-size artboard
 *  can't exhaust canvas memory on a phone. */
const MAX_PAGE_AREA = 12_000_000;

export interface RenderedPage {
  url: string;
  width: number;
  height: number;
}

/** Render one page (1-based) to a PNG object URL, `targetWidth` pixels wide. */
export async function renderPdfPage(doc: PdfDoc, pageNumber: number, targetWidth: number): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  try {
    const unit = page.getViewport({ scale: 1 });
    let scale = Math.max(0.1, targetWidth / unit.width);
    if (unit.width * unit.height * scale * scale > MAX_PAGE_AREA) {
      scale = Math.sqrt(MAX_PAGE_AREA / (unit.width * unit.height));
    }
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-2d-context");
    // Flatten onto white so transparent PDF backgrounds don't render black.
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("encode-failed");
    return { url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
  } finally {
    page.cleanup();
  }
}

// At most two thumbnails render at once, so an admin list full of PDFs fills
// in steadily instead of fighting over the worker all at the same moment.
let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/** Width buckets keep the cache small: a 40px row thumb and a 112px tile on a
 *  2x screen share one render instead of each getting their own. */
const THUMB_WIDTHS = [160, 320, 480, 720, 960];
const thumbCache = new Map<string, Promise<string>>();

/** Page 1 of a PDF as an object URL, at least `widthPx` wide (bucketed). */
export function pdfThumbUrl(src: string, widthPx: number): Promise<string> {
  const width = THUMB_WIDTHS.find((w) => w >= widthPx) ?? THUMB_WIDTHS[THUMB_WIDTHS.length - 1];
  const key = `${width}|${src}`;
  let p = thumbCache.get(key);
  if (!p) {
    p = limited(async () => {
      const doc = await openPdf(src);
      try {
        return (await renderPdfPage(doc, 1, width)).url;
      } finally {
        void doc.destroy();
      }
    });
    thumbCache.set(key, p);
    // Let a later mount retry (an expired link may have been re-signed).
    p.catch(() => thumbCache.delete(key));
  }
  return p;
}
