"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { startingFromCurve } from "@/lib/pricing/quote";
import type { CatalogProduct } from "./shared";

/**
 * Visual product picker for a manual-order line: searchable card grid with the
 * blank photo, brand/style and the shop's "as low as" price, instead of a bare
 * <select>. Staff see the same garment the customer would.
 */
export function ProductPickerDialog({
  open,
  onOpenChange,
  products,
  currentId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: CatalogProduct[];
  currentId: string;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      !q
        ? products
        : products.filter((p) =>
            [p.name, p.brand, p.ssStyleName].filter(Boolean).join(" ").toLowerCase().includes(q),
          ),
    [products, q],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pick a product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-5 pt-0">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, brand or style number…"
            aria-label="Search products"
          />
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {filtered.map((p) => {
              // First colour with a front photo; hidden products may have none.
              const img =
                p.colours.find((c) => c.images?.front)?.images?.front ?? null;
              // startingFromCurve returns 0 for an unpriceable curve, so a
              // falsy price means "no pricing" either way.
              const price = p.curve ? startingFromCurve(p.curve) : 0;
              const selected = p.id === currentId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onPick(p.id);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-xl border text-left transition-colors",
                    selected
                      ? "border-dream-purple ring-2 ring-dream-purple/25"
                      : "border-dream-line hover:border-dream-purple",
                  )}
                >
                  <div className="flex h-36 w-full items-center justify-center bg-dream-bg p-2">
                    {img ? (
                      <Image
                        src={img}
                        alt={p.name}
                        width={140}
                        height={140}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-dream-faint">No photo</span>
                    )}
                  </div>
                  <div className="space-y-1 p-3">
                    <div className="line-clamp-2 text-sm font-semibold leading-snug text-dream-ink">
                      {p.name}
                    </div>
                    <div className="truncate text-xs text-dream-muted">
                      {[p.brand, p.ssStyleName].filter(Boolean).join(" ") || "No S&S style"}
                      {p.colours.length > 0 && ` · ${p.colours.length} colours`}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {price > 0 ? (
                        <span className="text-xs font-semibold text-dream-ink">
                          as low as {formatCAD(price)}
                        </span>
                      ) : (
                        <Badge variant="warn">No pricing</Badge>
                      )}
                      {!p.isActive && <Badge variant="neutral">Hidden in shop</Badge>}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-dream-muted">
                No products match &ldquo;{query}&rdquo;.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
