/**
 * Reading artwork out of a saved design. A design stores one Fabric scene per
 * decorated view; the customer's own uploads sit alongside in
 * `source_artwork_files`. Both the per-line "View artwork" dialog and the
 * combined artwork sheet read them through here so they can never disagree.
 *
 * Image sources come in two flavours: inline data URLs (small art pasted into
 * the scene) and https Storage URLs (big uploads staged out of the scene).
 * Everything here handles both.
 *
 * Pure functions plus a few browser-only download helpers. Nothing runs at
 * import time, so this is safe to import from a server component.
 */

export interface SceneObject {
  type?: unknown;
  src?: unknown;
  text?: unknown;
  fill?: unknown;
  fontFamily?: unknown;
  fontSize?: unknown;
  fontWeight?: unknown;
  [key: string]: unknown;
}

export interface SceneJson {
  objects?: SceneObject[];
}

export interface SourceFile {
  name: string;
  path: string;
  url: string | null;
}

export interface ColourJson {
  name: string;
  hex: string;
}

export type PieceKind = "image" | "sticker" | "text";

export interface Piece {
  key: string;
  view: string;
  index: number;
  kind: PieceKind;
  object: SceneObject;
  /** data-URL or signed Storage URL for image/sticker thumbnails. */
  src?: string;
  /** the text string for text pieces. */
  text?: string;
  fill?: string;
}

const IMAGE_TYPE = /^image$/i;
const TEXT_TYPE = /^i-?text$/i;

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function asSceneMap(value: unknown): Record<string, SceneJson> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, SceneJson>;
}

export function asSourceFiles(value: unknown): SourceFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((f): f is SourceFile => !!f && typeof f === "object" && isString((f as SourceFile).name));
}

export function asColour(value: unknown): ColourJson | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Partial<ColourJson>;
  return isString(c.name) && isString(c.hex) ? { name: c.name, hex: c.hex } : null;
}

export function viewLabel(view: string): string {
  return view.charAt(0).toUpperCase() + view.slice(1);
}

export function designSlug(name: string | null): string {
  if (!name) return "design";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "design";
}

function isSvgDataUrl(src: string): boolean {
  return /^data:image\/svg\+xml/i.test(src);
}

export function isDataUrl(src: string): boolean {
  return /^data:image\//i.test(src);
}

/** Big uploads aren't inlined in the scene: they are staged to Storage and the
 *  scene holds a signed https URL (see the designer's save path). */
export function isHttpUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

export function isSvgSrc(src: string): boolean {
  if (isSvgDataUrl(src)) return true;
  if (!isHttpUrl(src)) return false;
  try {
    return /\.svg$/i.test(new URL(src).pathname);
  } catch {
    return false;
  }
}

/** Sniff the file extension out of a raster data-URL prefix or a storage URL path. */
export function rasterExtension(src: string): string {
  if (isHttpUrl(src)) {
    try {
      const ext = /\.([a-z0-9]+)$/i.exec(new URL(src).pathname)?.[1]?.toLowerCase();
      if (ext) return ext === "jpeg" ? "jpg" : ext;
    } catch {
      /* fall through to the default */
    }
    return "png";
  }
  const match = /^data:image\/([a-z0-9.+-]+)/i.exec(src);
  const mime = match ? match[1].toLowerCase() : "png";
  if (mime === "jpeg" || mime === "jpg") return "jpg";
  if (mime === "svg+xml") return "svg";
  return mime.replace(/[^a-z0-9]/g, "") || "png";
}

/** Does this filename look like something a browser can render inline? */
export function isImageFilename(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(name.trim());
}

/* ---------------------------- browser-only helpers ---------------------------- */

export function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function dataUrlToBlob(src: string): Blob {
  const [meta, payload] = src.split(",", 2);
  const mimeMatch = /^data:([^;]+)/.exec(meta);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  if (/;base64/i.test(meta)) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

/** Decode any raster blob (jpeg/webp/…) and re-encode it as PNG, the one
 *  image type the async clipboard accepts. */
export function reencodePng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, img.naturalWidth);
      canvas.height = Math.max(1, img.naturalHeight);
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

/** Rasterize an SVG string to a transparent PNG blob at 4x its intrinsic size. */
export function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const scale = 4;
      const w = Math.max(1, Math.round((img.naturalWidth || 512) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || 512) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG decode failed"));
    };
    img.src = url;
  });
}

/* --------------------------------- collection --------------------------------- */

/** Every placed image, sticker and text object across a design's views. */
export function collectPieces(scenes: Record<string, SceneJson>): Piece[] {
  const pieces: Piece[] = [];
  for (const [view, scene] of Object.entries(scenes)) {
    const objects = Array.isArray(scene?.objects) ? scene.objects : [];
    let imageN = 0;
    let stickerN = 0;
    let textN = 0;
    objects.forEach((object, i) => {
      const type = isString(object?.type) ? object.type : "";
      if (IMAGE_TYPE.test(type)) {
        // Accept inline data URLs AND staged Storage URLs (big uploads are not
        // inlined in the scene, so skipping https srcs made customer photos
        // silently vanish from this panel).
        const src = isString(object.src) ? object.src : null;
        if (!src || (!isDataUrl(src) && !isHttpUrl(src))) return;
        if (isSvgSrc(src)) {
          stickerN += 1;
          pieces.push({ key: `${view}-${i}`, view, index: stickerN, kind: "sticker", object, src });
        } else {
          imageN += 1;
          pieces.push({ key: `${view}-${i}`, view, index: imageN, kind: "image", object, src });
        }
      } else if (TEXT_TYPE.test(type)) {
        const text = isString(object.text) ? object.text : "";
        if (!text.trim()) return;
        textN += 1;
        pieces.push({
          key: `${view}-${i}`,
          view,
          index: textN,
          kind: "text",
          object,
          text,
          fill: isString(object.fill) ? object.fill : "#1b1458",
        });
      }
    });
  }
  return pieces;
}
