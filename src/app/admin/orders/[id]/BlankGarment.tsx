"use client";

import { useState } from "react";
import Image from "next/image";
import { ProofLightbox } from "./ProofLightbox";
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
 * Always-visible thumbnail row (no popup), sits above the big mockup like the
 * old Coastal Reign rail. Click a thumb to view full size, hover for a named
 * download, so admin can pull the exact garment (e.g. the exact red shirt).
 */
export function BlankGarment({
  product,
  colour,
}: {
  product: OrderProduct | undefined;
  colour: { name?: string; hex?: string | null };
}) {
  const [preview, setPreview] = useState<{ view: View; url: string } | null>(null);
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
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-dream-muted">Supplier blanks</p>
      <div className="flex flex-wrap gap-1.5">
        {views.map(({ view, url }) => (
          <span key={view} className="group relative">
            <button
              type="button"
              onClick={() => setPreview({ view, url })}
              title={`${matched.name} ${view} blank, click to view full size`}
              className="block h-12 w-12 overflow-hidden rounded-lg border border-dream-line bg-dream-bg transition-colors hover:border-dream-purple"
            >
              <Image src={url} alt={`${matched.name} ${view} blank`} width={48} height={48} className="h-full w-full object-contain" />
            </button>
            <button
              type="button"
              aria-label={`Download ${view} blank`}
              onClick={() => download(url, view)}
              className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-dream-ink/85 p-1 text-white group-hover:block"
            >
              {busy === url ? (
                <span className="block h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" aria-hidden />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden>
                  <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                </svg>
              )}
            </button>
          </span>
        ))}
      </div>

      {preview && (
        <ProofLightbox
          src={preview.url}
          kind="image"
          title={`${styleLabel} · ${matched.name} ${preview.view}`}
          open={!!preview}
          onOpenChange={(o) => !o && setPreview(null)}
        />
      )}
    </div>
  );
}
