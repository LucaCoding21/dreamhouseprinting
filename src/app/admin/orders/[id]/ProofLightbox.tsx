"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/use-toast";
import { imageToPdfBlob } from "@/lib/pdf/imageSheet";
import { downloadBlob } from "./artworkPieces";
import { PdfPages } from "@/components/orders/PdfPages";

/** Fullscreen viewer for a proof or mockup, image or PDF, so staff can
 *  double-check the real artwork at full size before (or after) it goes to
 *  the customer, and save it from right here (Julian: "add a save button when
 *  viewing mockup in full screen"). Images can also be saved as a letter-size
 *  PDF sheet, which is what he prints for the press. */
export function ProofLightbox({
  src,
  kind,
  title,
  fileStem,
  open,
  onOpenChange,
}: {
  src: string;
  kind: "image" | "pdf";
  title?: string;
  /** Download filename without extension. Falls back to a slug of the title. */
  fileStem?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"file" | "pdf" | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  const stem = fileStem || slug(title) || "artwork";

  async function fetchFile(): Promise<Blob> {
    if (src.startsWith("data:")) {
      const res = await fetch(src);
      return res.blob();
    }
    const res = await fetch(src);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return res.blob();
  }

  /** Save the file exactly as stored (PNG/JPG/PDF). */
  async function saveFile() {
    setBusy("file");
    try {
      const blob = await fetchFile();
      downloadBlob(blob, `${stem}.${extensionFor(blob, src, kind)}`);
    } catch {
      toast({ title: "Could not save", description: "The file could not be fetched. Try again in a moment.", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  /** Save an image as a one-page letter PDF with the title printed above it. */
  async function savePdf() {
    setBusy("pdf");
    try {
      const blob = await fetchFile();
      const pdf = await imageToPdfBlob(blob, { title });
      downloadBlob(pdf, `${stem}.pdf`);
    } catch {
      toast({ title: "Could not build the PDF", description: "The image could not be rendered to PDF.", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium transition-colors hover:bg-white/20 disabled:opacity-50";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-dream-overlay/90 backdrop-blur-sm"
      // A left-click anywhere but the controls closes the viewer, per Julian:
      // "clicking anywhere out of here closes the window". The image is NOT
      // exempt: its object-contain layout box spans the whole letterboxed
      // area, so exempting <img> would swallow every "outside" click too.
      // The PDF keeps its clicks: the fallback iframe's viewer needs them, and
      // the rendered pages scroll (grabbing the scrollbar must not close it).
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest("iframe, button, a, [data-pdf-scroll]")) return;
        onOpenChange(false);
      }}
    >
      {/* Title + Close up top; the Save actions live in a bar UNDER the
          image (thumb reach on a phone, per Julian). */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3 text-white">
        <span className="min-w-0 truncate text-sm font-medium">{title ?? "Proof preview"}</span>
        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close fullscreen" className={btn}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-4 w-4" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
          Close
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        {kind === "pdf" ? (
          // Rendered pages (a PDF iframe is blank on Android Chrome); the
          // iframe is only the fallback when pdf.js can't read the file.
          <div data-pdf-scroll className="flex h-full w-full max-w-5xl flex-col overflow-y-auto overscroll-contain">
            <PdfPages
              key={src}
              src={src}
              title={title ?? "Proof PDF"}
              className="my-auto"
              fallback={<iframe src={src} title={title ?? "Proof PDF"} className="min-h-0 w-full flex-1 rounded-lg bg-white" />}
            />
          </div>
        ) : (
          <Image
            src={src}
            alt={title ?? "Proof"}
            width={1600}
            height={1600}
            unoptimized
            className={cn("max-h-full max-w-full object-contain")}
          />
        )}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white">
        <button type="button" onClick={saveFile} disabled={busy !== null} className={btn} title="Download the file as stored">
          <IconDownload />
          {busy === "file" ? "Saving…" : kind === "pdf" ? "Save PDF" : "Save image"}
        </button>
        {kind === "image" && (
          <button type="button" onClick={savePdf} disabled={busy !== null} className={btn} title="Letter-size PDF sheet, ready to print">
            <IconDownload />
            {busy === "pdf" ? "Building…" : "Save as PDF"}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13.5h11" />
    </svg>
  );
}

function slug(s: string | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Pick the download extension from the blob's MIME type, then the URL, then the kind. */
function extensionFor(blob: Blob, src: string, kind: "image" | "pdf"): string {
  const byMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
  };
  if (byMime[blob.type]) return byMime[blob.type];
  const m = /\.([a-z0-9]{2,4})(?:[?#]|$)/i.exec(src);
  if (m) return m[1].toLowerCase();
  return kind === "pdf" ? "pdf" : "png";
}

/** Trigger the lightbox off any proof src; renders its own button + overlay state. */
export function fileKind(nameOrType: string): "image" | "pdf" {
  return /pdf/i.test(nameOrType) ? "pdf" : "image";
}

/**
 * Open a proof / mockup in a new browser tab (staff preference over the
 * in-page lightbox). Call it straight from a click handler so the popup
 * blocker sees the user gesture. data: URLs (scene exports) can't be opened as
 * a top-level tab in Chrome, so they're decoded into a Blob URL first.
 */
export function openInNewTab(src: string) {
  if (!src) return;
  let url = src;
  if (src.startsWith("data:")) {
    const [head, body = ""] = src.split(",", 2);
    const mime = /data:([^;,]+)/.exec(head)?.[1] ?? "application/octet-stream";
    const bytes = head.includes(";base64")
      ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(body));
    url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    // The new tab has loaded it by then; free the memory.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  // Blob URLs are same-origin and must keep the opener to resolve in the new
  // tab; real file URLs get noopener.
  window.open(url, "_blank", url.startsWith("blob:") ? undefined : "noopener,noreferrer");
}
