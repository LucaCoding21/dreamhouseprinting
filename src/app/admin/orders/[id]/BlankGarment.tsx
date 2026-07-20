"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { type OrderProduct } from "./shared";
import type { ProductColourJson } from "@/lib/db/rows";

type View = "front" | "back" | "side";
const VIEW_ORDER: View[] = ["front", "back", "side"];

/** Match the line's colour to a product colour (by name, then hex). */
function resolveColour(
  colours: ProductColourJson[] | null | undefined,
  name: string | undefined,
  hex: string | null | undefined,
): ProductColourJson | null {
  const list = colours ?? [];
  if (!list.length) return null;
  const norm = (s: string) => s.trim().toLowerCase();
  if (name) {
    const byName = list.find((c) => norm(c.name) === norm(name));
    if (byName) return byName;
  }
  if (hex) {
    const byHex = list.find((c) => c.hex && norm(c.hex) === norm(hex));
    if (byHex) return byHex;
  }
  return null;
}

function sanitize(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

/**
 * The exact S&S blank garment for a line, the customer's colour with no art.
 * Compact button that opens a modal of the front/back/side blanks, each
 * downloadable, so admin can pull the exact garment (e.g. the exact red shirt).
 */
export function BlankGarment({
  product,
  colour,
}: {
  product: OrderProduct | undefined;
  colour: { name?: string; hex?: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!product) return null;
  const matched = resolveColour(product.colours, colour.name, colour.hex);
  if (!matched) return null;

  const styleLabel = product.brand ? `${product.brand} ${product.ss_style_name ?? ""}`.trim() : product.ss_style_name ?? product.name;
  const views = VIEW_ORDER.map((v) => ({ view: v, url: matched.images?.[v] ?? null })).filter(
    (x): x is { view: View; url: string } => !!x.url,
  );
  if (!views.length) return null;

  async function download(url: string, view: string) {
    const filename = `${sanitize([styleLabel, matched!.name, view].filter(Boolean).join("-"))}.png`;
    setBusy(url);
    try {
      // S&S CDN allows cross-origin fetch, so we can save a real file with a sensible name.
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open in a new tab so admin can still save it manually.
      window.open(url, "_blank", "noopener");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="w-full justify-center gap-1.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        View supplier blanks
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" backdropClassName="bg-dream-overlay/50 backdrop-blur-sm">
          <DialogClose />
          <DialogHeader>
            <DialogTitle>Supplier blank: {styleLabel}</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5">
            <p className="mb-4 inline-flex items-center gap-1.5 text-sm text-dream-muted">
              Colour:
              <span className="h-3.5 w-3.5 rounded-full border border-dream-line-strong" style={{ background: matched.hex ?? "#fff" }} />
              <span className="font-medium text-dream-ink">{matched.name}</span>
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {views.map(({ view, url }) => (
                <figure key={view} className="space-y-2">
                  <div className="aspect-square overflow-hidden rounded-xl border border-dream-line bg-dream-bg">
                    <Image src={url} alt={`${matched.name} ${view} blank`} width={400} height={400} className="h-full w-full object-contain" />
                  </div>
                  <figcaption className="text-center text-sm font-medium capitalize text-dream-ink">{view}</figcaption>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center gap-1.5"
                    loading={busy === url}
                    onClick={() => download(url, view)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
                      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                    </svg>
                    Download
                  </Button>
                </figure>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
