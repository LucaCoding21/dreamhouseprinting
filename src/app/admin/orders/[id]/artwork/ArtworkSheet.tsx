"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export interface ArtworkTile {
  key: string;
  /** image: render it full size. text: text art from the designer. file: a non-image upload (PDF, AI …). */
  kind: "image" | "text" | "file";
  label: string;
  src: string | null;
  /** Where "Open" points, usually the same as src. */
  href: string | null;
  /** Original filename, for the file tiles. */
  name?: string | null;
  text?: string | null;
  fill?: string | null;
}

export interface ArtworkSection {
  id: string;
  title: string;
  subtitle: string | null;
  colourHex: string | null;
  tiles: ArtworkTile[];
}

/**
 * White, print-friendly sheet of every artwork and mockup on an order. The
 * print rules isolate this element: the admin shell is a fixed-height flex
 * column with its own scroll container, which would otherwise clip the print
 * to a single screen.
 */
export function ArtworkSheet({
  orderId,
  orderNumber,
  customerName,
  sections,
}: {
  orderId: string;
  orderNumber: string | null;
  customerName: string | null;
  sections: ArtworkSection[];
}) {
  const total = sections.reduce((n, s) => n + s.tiles.length, 0);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div id="artwork-sheet" className="mx-auto max-w-4xl bg-white px-8 py-8 text-dream-ink">
        <div className="artwork-hide mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-dream-line pb-4">
          <Link href={`/admin/orders/${orderId}`} className="text-sm text-dream-purple hover:underline">
            Back to order
          </Link>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </div>

        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold">Artwork, order {orderNumber ?? ""}</h1>
          <p className="mt-1 text-sm text-dream-muted">
            {[customerName, `${total} ${total === 1 ? "file" : "files"}`].filter(Boolean).join("  ·  ")}
          </p>
        </header>

        {sections.length === 0 && <p className="text-sm text-dream-muted">This order has no artwork on file yet.</p>}

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.id} className="artwork-block">
              <div className="mb-4 flex items-center gap-2 border-b border-dream-line pb-2">
                {section.colourHex && (
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-dream-line-strong"
                    style={{ backgroundColor: section.colourHex }}
                    aria-hidden
                  />
                )}
                <div>
                  <h2 className="font-display text-xl font-bold">{section.title}</h2>
                  {section.subtitle && <p className="text-sm text-dream-muted">{section.subtitle}</p>}
                </div>
              </div>

              {section.tiles.length === 0 ? (
                <p className="text-sm text-dream-muted">No artwork on this line.</p>
              ) : (
                <div className="space-y-8">
                  {section.tiles.map((tile) => (
                    <figure key={tile.key} className="artwork-block">
                      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{tile.label}</span>
                        {tile.href && (
                          <a
                            href={tile.href}
                            target="_blank"
                            rel="noreferrer"
                            className="artwork-hide text-xs font-medium text-dream-purple hover:underline"
                          >
                            Open full size
                          </a>
                        )}
                      </figcaption>

                      {tile.kind === "image" && tile.src ? (
                        // Plain img: these are signed Storage URLs and data URLs
                        // at their original resolution, no optimizer in the way.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tile.src}
                          alt={tile.label}
                          className="max-h-[70vh] w-auto max-w-full rounded-lg border border-dream-line bg-white object-contain"
                        />
                      ) : tile.kind === "text" ? (
                        <div
                          className="rounded-lg border border-dream-line bg-white px-5 py-6 text-center font-display text-3xl font-bold leading-tight"
                          style={{ color: tile.fill ?? undefined }}
                        >
                          {tile.text}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-dream-line px-4 py-3 text-sm text-dream-muted">
                          {tile.name ?? "File"}
                          {tile.href ? " (open the link above to download)" : " (no download link on file)"}
                        </div>
                      )}
                    </figure>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Print only the sheet. `visibility` hides the admin shell without removing it
 * from the layout, and absolute positioning lifts the sheet out of the shell's
 * scroll container so it can run over as many pages as it needs.
 */
const PRINT_CSS = `
@media print {
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  body * { visibility: hidden !important; }
  #artwork-sheet, #artwork-sheet * { visibility: visible !important; }
  #artwork-sheet {
    position: absolute !important;
    left: 0; top: 0;
    width: 100%; max-width: none;
    padding: 0 !important;
  }
  #artwork-sheet .artwork-hide { display: none !important; }
  #artwork-sheet .artwork-block { break-inside: avoid; page-break-inside: avoid; }
  #artwork-sheet img { max-height: none !important; }
}
`;
