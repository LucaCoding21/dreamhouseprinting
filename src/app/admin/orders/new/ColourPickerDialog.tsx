"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { swatchStyle } from "@/lib/swatch";
import type { ProductColourJson } from "@/lib/db/rows";

/**
 * Visual colourway picker for a manual-order line, the colour twin of
 * ProductPickerDialog: searchable card grid with the blank photo in each
 * colour, so staff pick off the real garment instead of a name in a <select>.
 */
export function ColourPickerDialog({
  open,
  onOpenChange,
  productName,
  colours,
  currentName,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  colours: ProductColourJson[];
  currentName: string;
  onPick: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () => (!q ? colours : colours.filter((c) => c.name.toLowerCase().includes(q))),
    [colours, q],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pick a colour · {productName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-5 pt-0">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search colours…"
            aria-label="Search colours"
          />
          <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4">
            {filtered.map((c) => {
              const img = c.images?.front ?? c.images?.back ?? c.images?.side ?? null;
              const selected = c.name === currentName;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    onPick(c.name);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-xl border text-left transition-colors",
                    selected
                      ? "border-dream-purple ring-2 ring-dream-purple/25"
                      : "border-dream-line hover:border-dream-purple",
                  )}
                >
                  <div className="flex h-28 w-full items-center justify-center bg-dream-bg p-2">
                    {img ? (
                      <Image
                        src={img}
                        alt={`${productName} in ${c.name}`}
                        width={110}
                        height={110}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      // No supplier photo for this colour, the swatch carries it.
                      <span
                        aria-hidden
                        className="h-12 w-12 rounded-full border border-dream-line-strong"
                        style={swatchStyle({ name: c.name, hex: c.hex ?? null })}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 p-2.5">
                    <span
                      aria-hidden
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-dream-line-strong"
                      style={swatchStyle({ name: c.name, hex: c.hex ?? null })}
                    />
                    <span className="truncate text-xs font-semibold text-dream-ink">{c.name}</span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-dream-muted">
                No colours match &ldquo;{query}&rdquo;.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
