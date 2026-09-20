// Client-side artwork intake for the designer: validates size/type, reads
// renderable images to a data URL, and rasterizes the first page of a PDF so it
// can be placed on the Fabric canvas. The *original* file is still uploaded as
// the print-ready source, this only produces the on-canvas preview.

// Matches the server cap in /api/design/upload and the `artwork` bucket limit.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Raster/vector formats browsers can draw into an <img>/canvas (what Fabric needs). */
const RENDERABLE_IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
const RENDERABLE_IMAGE_MIME = /^image\/(png|jpe?g|gif|webp|svg\+xml|bmp|avif)$/;

export type FileKind =
  | { kind: "image" }
  | { kind: "pdf" }
  | { kind: "unsupported"; message: string };

function ext(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Decide how (or whether) we can preview a picked file, with a friendly reason when we can't. */
export function classifyFile(file: File): FileKind {
  const e = ext(file.name);
  const type = (file.type || "").toLowerCase();

  if (type === "application/pdf" || e === "pdf") return { kind: "pdf" };
  if (RENDERABLE_IMAGE_MIME.test(type) || RENDERABLE_IMAGE_EXT.includes(e)) return { kind: "image" };

  if (type.includes("heic") || type.includes("heif") || e === "heic" || e === "heif") {
    return {
      kind: "unsupported",
      message:
        "iPhone HEIC photos can't be previewed here. In your iPhone Camera settings choose “Most Compatible,” or upload a JPG/PNG.",
    };
  }
  if (type.includes("tiff") || e === "tiff" || e === "tif") {
    return { kind: "unsupported", message: "TIFF files can't be previewed, please upload a PNG, JPG, SVG, or PDF." };
  }
  return { kind: "unsupported", message: "That file type can't be previewed, please upload a PNG, JPG, SVG, or PDF." };
}

/** Read a browser-renderable image file to a data URL. */
export function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

/** Rasterize page 1 of a PDF to a PNG data URL. Returns the render + total page count. */
export async function renderPdfFirstPage(file: File): Promise<{ dataUrl: string; numPages: number }> {
  const pdfjs = await import("pdfjs-dist");
  // Bundled worker (offline-safe, version-matched), resolved by Turbopack.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  try {
    const page = await pdf.getPage(1);
    // Scale so the longest side lands near 1600px, crisp for preview + mockup,
    // without exploding memory on a large-format artboard.
    const unit = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 1600 / Math.max(unit.width, unit.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-2d-context");
    // Flatten onto white so transparent/none PDF backgrounds don't render black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    return { dataUrl: canvas.toDataURL("image/png"), numPages: pdf.numPages };
  } finally {
    pdf.destroy();
  }
}
