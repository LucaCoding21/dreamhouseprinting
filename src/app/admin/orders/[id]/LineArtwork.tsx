"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { ProofLightbox } from "./ProofLightbox";
import {
  asSceneMap,
  asSourceFiles,
  collectPieces,
  dataUrlToBlob,
  designSlug,
  downloadBlob,
  isHttpUrl,
  rasterExtension,
  reencodePng,
  svgToPngBlob,
  viewLabel,
  type Piece,
} from "./artworkPieces";
import type { DesignRow } from "@/lib/db/rows";

/**
 * Per-line raw artwork, an inline "Raw images (N)" dropdown in the left rail
 * (Coastal Reign style): expand to small thumbnails of the customer's original
 * uploads and every design piece (image / sticker / text). Click a thumb to
 * view it full size, hover for a download. One design per line.
 */
export function LineArtwork({ design }: { design: DesignRow | undefined }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Piece | null>(null);
  const [renderingKey, setRenderingKey] = useState<string | null>(null);

  if (!design) return null;
  const slug = designSlug(design.name);
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

  /** Render a text piece to a transparent PNG blob via an offscreen Fabric canvas. */
  async function renderTextPng(piece: Piece): Promise<Blob> {
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
    return dataUrlToBlob(dataUrl);
  }

  async function downloadText(piece: Piece) {
    setRenderingKey(piece.key);
    try {
      downloadBlob(await renderTextPng(piece), `${slug}-${piece.view}-text-${piece.index}.png`);
    } catch {
      toast({ title: "Could not render text", description: "The text art could not be exported to PNG.", variant: "error" });
    } finally {
      setRenderingKey(null);
    }
  }

  /** Fetch a piece's pixels as a PNG blob (the only image type the clipboard takes). */
  async function piecePngBlob(piece: Piece): Promise<Blob> {
    if (piece.kind === "text") return renderTextPng(piece);
    if (!piece.src) throw new Error("no src");
    if (piece.kind === "sticker") {
      let svg: string;
      if (isHttpUrl(piece.src)) {
        svg = await (await fetch(piece.src)).text();
      } else {
        const [, payload = ""] = piece.src.split(",", 2);
        svg = /;base64/i.test(piece.src) ? atob(payload) : decodeURIComponent(payload);
      }
      return svgToPngBlob(svg);
    }
    const blob = isHttpUrl(piece.src) ? await (await fetch(piece.src)).blob() : dataUrlToBlob(piece.src);
    return blob.type === "image/png" ? blob : reencodePng(blob);
  }

  /** Copy a piece to the clipboard as a PNG, so it pastes straight into design tools. */
  async function copyPiece(piece: Piece) {
    setRenderingKey(piece.key);
    try {
      // Hand the clipboard a promise: Safari requires the write to start
      // inside the user gesture, before any await.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": piecePngBlob(piece) })]);
      toast({ title: "Copied to clipboard", description: "Paste it anywhere as a PNG.", variant: "success" });
    } catch {
      toast({ title: "Could not copy", description: "The image could not be copied. Try the download instead.", variant: "error" });
    } finally {
      setRenderingKey(null);
    }
  }

  const count = pieces.length + sourceFiles.length;
  const download = (piece: Piece) => {
    if (piece.kind === "image") void downloadImage(piece);
    else if (piece.kind === "sticker") void downloadSticker(piece);
    else void downloadText(piece);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-sm font-medium text-dream-ink transition-colors hover:text-dream-purple"
      >
        Raw images ({count})
        <Chevron open={open} />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {pieces.map((piece) => (
              <span key={`${design.id}-${piece.key}`} className="group relative">
                <button
                  type="button"
                  title={
                    piece.kind === "text"
                      ? `Text "${piece.text ?? ""}" (${viewLabel(piece.view)}), click to render + download`
                      : `${piece.kind === "sticker" ? "Sticker" : "Image"} (${viewLabel(piece.view)}), click to view full size`
                  }
                  onClick={() => (piece.src ? setPreview(piece) : download(piece))}
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-dream-line bg-dream-bg p-1 transition-colors hover:border-dream-purple"
                >
                  {piece.kind === "text" ? (
                    renderingKey === piece.key ? (
                      <span className="block h-4 w-4 animate-spin rounded-full border border-dream-purple border-t-transparent" aria-hidden />
                    ) : (
                      <span className="line-clamp-3 text-center font-display text-[10px] font-bold leading-tight" style={{ color: piece.fill }}>
                        {piece.text}
                      </span>
                    )
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={piece.src} alt={viewLabel(piece.view)} className="max-h-full max-w-full object-contain" />
                  )}
                </button>
                {/* Copy first (Julian pastes these into his design tools);
                    download stays as the smaller second action. */}
                <button
                  type="button"
                  aria-label="Copy this artwork to the clipboard"
                  title="Copy to clipboard"
                  onClick={() => void copyPiece(piece)}
                  className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-dream-purple p-1 text-white group-hover:block"
                >
                  <CopyIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label="Download this artwork"
                  title="Download file"
                  onClick={() => download(piece)}
                  className="absolute -bottom-1.5 -right-1.5 hidden rounded-full bg-dream-ink/85 p-1 text-white group-hover:block"
                >
                  <DownloadIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {sourceFiles.map((file, i) =>
            file.url ? (
              <a
                key={`${file.path}-${i}`}
                href={file.url}
                download={file.name}
                className="flex max-w-full items-center gap-1.5 rounded-lg border border-dream-line bg-dream-bg px-2 py-1.5 text-xs text-dream-ink transition-colors hover:border-dream-purple hover:bg-dream-lavender-soft"
              >
                <DownloadIcon className="h-3.5 w-3.5 shrink-0 text-dream-purple" />
                <span className="truncate">{file.name}</span>
              </a>
            ) : (
              <span
                key={`${file.path}-${i}`}
                className="flex max-w-full items-center gap-1.5 rounded-lg border border-dashed border-dream-line px-2 py-1.5 text-xs text-dream-muted"
                title="Download link unavailable"
              >
                <span className="truncate">{file.name}</span>
              </span>
            ),
          )}
        </div>
      )}

      {preview?.src && (
        <ProofLightbox
          src={preview.src}
          kind="image"
          title={`${design.name ?? "Design"} · ${viewLabel(preview.view)}`}
          open={!!preview}
          onOpenChange={(o) => !o && setPreview(null)}
        />
      )}
    </div>
  );
}

/** Small chevron for the collapsible rail sections. */
export function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
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
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
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
