"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import type { DesignRow } from "@/lib/db/rows";

interface SceneObject {
  type?: unknown;
  src?: unknown;
  text?: unknown;
  fill?: unknown;
  fontFamily?: unknown;
  fontSize?: unknown;
  fontWeight?: unknown;
  [key: string]: unknown;
}

interface SceneJson {
  objects?: SceneObject[];
}

interface SourceFile {
  name: string;
  path: string;
  url: string | null;
}

interface ColourJson {
  name: string;
  hex: string;
}

type PieceKind = "image" | "sticker" | "text";

interface Piece {
  key: string;
  view: string;
  index: number;
  kind: PieceKind;
  object: SceneObject;
  /** data-URL for image/sticker thumbnails. */
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

function asSceneMap(value: unknown): Record<string, SceneJson> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, SceneJson>;
}

function asSourceFiles(value: unknown): SourceFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is SourceFile => !!f && typeof f === "object" && isString((f as SourceFile).name),
  );
}

function asColour(value: unknown): ColourJson | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Partial<ColourJson>;
  return isString(c.name) && isString(c.hex) ? { name: c.name, hex: c.hex } : null;
}

function viewLabel(view: string): string {
  return view.charAt(0).toUpperCase() + view.slice(1);
}

function designSlug(name: string | null): string {
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

function isDataUrl(src: string): boolean {
  return /^data:image\//i.test(src);
}

/** Big uploads aren't inlined in the scene: they are staged to Storage and the
 *  scene holds a signed https URL (see the designer's save path). */
function isHttpUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

function isSvgSrc(src: string): boolean {
  if (isSvgDataUrl(src)) return true;
  if (!isHttpUrl(src)) return false;
  try {
    return /\.svg$/i.test(new URL(src).pathname);
  } catch {
    return false;
  }
}

/** Sniff the file extension out of a raster data-URL prefix or a storage URL path. */
function rasterExtension(src: string): string {
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

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataUrlToBlob(src: string): Blob {
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

function collectPieces(scenes: Record<string, SceneJson>): Piece[] {
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

/**
 * Per-line artwork viewer, a "View artwork" button that opens a modal with the
 * customer's original uploads and every design piece (image / sticker / text),
 * each downloadable, ready to drop into a proof. One design per line.
 */
export function LineArtwork({ design }: { design: DesignRow | undefined }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [renderingKey, setRenderingKey] = useState<string | null>(null);

  if (!design) return null;
  const slug = designSlug(design.name);
  const colour = asColour(design.colour);
  const sourceFiles = asSourceFiles(design.source_artwork_files);
  const pieces = collectPieces(asSceneMap(design.scene_definition));
  if (pieces.length === 0 && sourceFiles.length === 0) return null;

  async function downloadImage(piece: Piece) {
    if (!piece.src) return;
    try {
      const blob = isHttpUrl(piece.src) ? await (await fetch(piece.src)).blob() : dataUrlToBlob(piece.src);
      const ext = rasterExtension(piece.src);
      downloadBlob(blob, `${slug}-${piece.view}-image-${piece.index}.${ext}`);
    } catch {
      toast({ title: "Could not download image", description: "The image could not be fetched or decoded.", variant: "error" });
    }
  }

  async function downloadSticker(piece: Piece) {
    if (!piece.src) return;
    try {
      let svg: string;
      if (isHttpUrl(piece.src)) {
        svg = await (await fetch(piece.src)).text();
      } else {
        const [, payload = ""] = piece.src.split(",", 2);
        svg = /;base64/i.test(piece.src) ? atob(payload) : decodeURIComponent(payload);
      }
      const blob = new Blob([svg], { type: "image/svg+xml" });
      downloadBlob(blob, `${slug}-${piece.view}-sticker-${piece.index}.svg`);
    } catch {
      toast({ title: "Could not download sticker", description: "The vector data could not be fetched or decoded.", variant: "error" });
    }
  }

  async function downloadText(piece: Piece) {
    setRenderingKey(piece.key);
    try {
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }
      const fabric = await import("fabric");
      const enlivened = await fabric.util.enlivenObjects<InstanceType<typeof fabric.FabricObject>>([
        piece.object as Record<string, unknown>,
      ]);
      const obj = enlivened[0];
      if (!obj) throw new Error("no object");

      // Shift so the bounding rect's top-left lands at (margin, margin).
      const margin = 24;
      const bounds = obj.getBoundingRect();
      obj.set({ left: (obj.left ?? 0) - bounds.left + margin, top: (obj.top ?? 0) - bounds.top + margin });
      obj.setCoords();

      const canvas = new fabric.StaticCanvas(undefined, {
        width: Math.max(1, Math.ceil(bounds.width) + margin * 2),
        height: Math.max(1, Math.ceil(bounds.height) + margin * 2),
        backgroundColor: undefined,
        enableRetinaScaling: false,
      });
      canvas.add(obj);
      canvas.renderAll();

      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 4 });
      canvas.dispose();

      downloadBlob(dataUrlToBlob(dataUrl), `${slug}-${piece.view}-text-${piece.index}.png`);
    } catch {
      toast({ title: "Could not render text", description: "The text art could not be exported to PNG.", variant: "error" });
    } finally {
      setRenderingKey(null);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="w-full justify-center gap-1.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
        View artwork
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl" backdropClassName="bg-dream-overlay/50 backdrop-blur-sm">
          <DialogClose />
          <DialogHeader>
            <DialogTitle>Artwork: {design.name ?? "Untitled design"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-6 overflow-y-auto px-5 pb-5">
            {colour && (
              <p className="inline-flex items-center gap-1.5 text-sm text-dream-muted">
                Colour:
                <span className="h-3.5 w-3.5 rounded-full border border-dream-line-strong" style={{ backgroundColor: colour.hex }} />
                <span className="font-medium text-dream-ink">{colour.name}</span>
              </p>
            )}

            {sourceFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-dream-muted">Original uploads</p>
                <div className="flex flex-wrap gap-2">
                  {sourceFiles.map((file, i) =>
                    file.url ? (
                      <a
                        key={`${file.path}-${i}`}
                        href={file.url}
                        download={file.name}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-dream-line bg-dream-bg px-3 py-1.5 text-xs text-dream-ink transition-colors hover:border-dream-purple hover:bg-dream-lavender-soft"
                      >
                        <DownloadIcon className="h-3.5 w-3.5 shrink-0 text-dream-purple" />
                        <span className="truncate">{file.name}</span>
                      </a>
                    ) : (
                      <span
                        key={`${file.path}-${i}`}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-dashed border-dream-line px-3 py-1.5 text-xs text-dream-muted"
                        title="Download link unavailable"
                      >
                        <span className="truncate">{file.name}</span>
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}

            {pieces.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-dream-muted">Design pieces</p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
                  {pieces.map((piece) => (
                    <PieceTile
                      key={`${design.id}-${piece.key}`}
                      piece={piece}
                      rendering={renderingKey === piece.key}
                      onDownload={() => {
                        if (piece.kind === "image") void downloadImage(piece);
                        else if (piece.kind === "sticker") void downloadSticker(piece);
                        else void downloadText(piece);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PieceTileProps {
  piece: Piece;
  rendering: boolean;
  onDownload: () => void;
}

function PieceTile({ piece, rendering, onDownload }: PieceTileProps) {
  const label = piece.kind === "image" ? "Image" : piece.kind === "sticker" ? "Sticker" : `"${piece.text ?? ""}"`;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-dream-line bg-dream-surface">
      <div className="relative flex aspect-square items-center justify-center bg-dream-bg p-2">
        {piece.kind === "text" ? (
          <div className="line-clamp-3 text-center font-display text-base font-bold leading-tight" style={{ color: piece.fill }}>
            {piece.text}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={piece.src} alt={label} className="max-h-full max-w-full object-contain" />
        )}
        {piece.kind === "sticker" && (
          <span className="absolute right-1.5 top-1.5 rounded bg-dream-ink/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
            SVG
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-dream-ink" title={label}>
            {label}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-dream-muted">{viewLabel(piece.view)}</p>
        </div>
        <Button size="sm" variant="secondary" className="w-full" loading={rendering} onClick={onDownload}>
          {!rendering && <DownloadIcon className="h-3.5 w-3.5" />}
          Download
        </Button>
      </div>
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
