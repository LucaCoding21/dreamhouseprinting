"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { LBL, useOrderAction } from "./shared";
import { listSwapProductsAction, changeLineItemProductAction, type SwapProduct } from "../actions";
import { swatchStyle } from "@/lib/swatch";

/**
 * "Change product" on a line item, for when the customer changes their mind
 * mid-order and admin swaps the blank for them. Two steps, both explicit:
 *   1. search + pick the new product (photo thumbnails)
 *   2. pick a colour on it. REQUIRED, never auto-selected, since colour
 *      names/hexes don't map 1:1 between garments.
 * Sizes, prints, notes, artwork and pricing all stay on the line.
 */
export function ChangeProductDialog({
  orderId,
  lineItemId,
  currentProductId,
  onChanged,
}: {
  orderId: string;
  lineItemId: string;
  currentProductId: string | undefined;
  /** Fired after a successful swap so the parent can sync its local item state. */
  onChanged: (productName: string, priceSuggestion: { unit: number; qty: number } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<SwapProduct[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<SwapProduct | null>(null);
  const [colourName, setColourName] = useState<string | null>(null);
  const { pending, run } = useOrderAction();

  function openDialog() {
    setPicked(null);
    setColourName(null);
    setQuery("");
    setLoadError(null);
    setOpen(true);
    if (!products) {
      listSwapProductsAction().then((res) => {
        if (res.error || !res.products) setLoadError(res.error ?? "Could not load products.");
        else setProducts(res.products);
      });
    }
  }

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.brand ?? "", p.ssStyleName ?? ""].some((s) => s.toLowerCase().includes(q)),
    );
  }, [products, query]);

  function apply() {
    if (!picked || !colourName) return;
    let suggestion: { unit: number; qty: number } | null = null;
    run(
      async () => {
        const res = await changeLineItemProductAction(orderId, lineItemId, picked.id, colourName);
        if (!res.error) suggestion = res.suggestion ?? null;
        return res;
      },
      "Product changed",
      () => {
        setOpen(false);
        onChanged(picked.name, suggestion);
      },
    );
  }

  return (
    <>
      <button type="button" onClick={openDialog} className="text-sm font-medium text-dream-purple hover:underline">
        Change product
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>{picked ? "Pick a colour" : "Change product"}</DialogTitle>
          </DialogHeader>

          {!picked ? (
            /* ── Step 1: pick the new product ── */
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, brand or style number…"
              />
              <p className="text-xs text-dream-muted">
                Sizes, prints, notes and pricing stay on the line. You pick the colour next.
              </p>
              <div className="min-h-0 flex-1 divide-y divide-dream-line overflow-y-auto rounded-lg border border-dream-line">
                {loadError && <p className="p-4 text-sm text-dream-danger">{loadError}</p>}
                {!products && !loadError && <p className="p-4 text-sm text-dream-muted">Loading products…</p>}
                {products && filtered.length === 0 && (
                  <p className="p-4 text-sm text-dream-muted">No products match “{query}”.</p>
                )}
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPicked(p);
                      setColourName(null);
                    }}
                    className="flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-dream-bg"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dream-line bg-dream-bg">
                      {p.thumb ? (
                        <Image src={p.thumb} alt={p.name} width={56} height={56} className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-dream-faint">No photo</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-dream-ink">{p.name}</span>
                        {p.id === currentProductId && <Badge variant="info">Current</Badge>}
                        {!p.isActive && <Badge variant="neutral">Hidden from shop</Badge>}
                        {p.stockStatus === "out_of_stock" && <Badge variant="warn">Out of stock</Badge>}
                      </div>
                      <div className="text-xs text-dream-muted">
                        {[p.brand, p.ssStyleName].filter(Boolean).join(" ")}
                        {p.colours.length > 0 && <> · {p.colours.length} colours</>}
                      </div>
                    </div>
                    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 text-dream-faint" aria-hidden>
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Step 2: pick a colour on the new product (required) ── */
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dream-line bg-dream-bg">
                  {picked.thumb ? (
                    <Image src={picked.thumb} alt={picked.name} width={48} height={48} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-dream-faint">No photo</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-dream-ink">{picked.name}</div>
                  <div className="text-xs text-dream-muted">{[picked.brand, picked.ssStyleName].filter(Boolean).join(" ")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null);
                    setColourName(null);
                  }}
                  className="shrink-0 text-sm font-medium text-dream-purple hover:underline"
                >
                  Choose different product
                </button>
              </div>

              <div className={LBL}>Colour (required, nothing is carried over)</div>
              {picked.colours.length === 0 ? (
                <p className="rounded-lg border border-dream-line p-4 text-sm text-dream-muted">
                  This product has no colours configured. Set them up in the product editor first.
                </p>
              ) : (
                <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto rounded-lg border border-dream-line p-3 sm:grid-cols-4">
                  {picked.colours.map((c) => {
                    const selected = colourName === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setColourName(c.name)}
                        className={cn(
                          "rounded-lg border p-2 text-left transition-colors",
                          selected ? "border-dream-purple ring-2 ring-dream-purple" : "border-dream-line hover:bg-dream-bg",
                        )}
                      >
                        <div className="mb-1.5 flex h-16 items-center justify-center overflow-hidden rounded-md bg-dream-bg">
                          {c.thumb ? (
                            <Image src={c.thumb} alt={c.name} width={64} height={64} className="h-full w-full object-contain" />
                          ) : (
                            <span className="h-8 w-8 rounded-full border border-dream-line-strong" style={swatchStyle(c)} />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-dream-line-strong" style={swatchStyle(c)} />
                          <span className="truncate text-xs font-medium text-dream-ink">{c.name}</span>
                        </div>
                        {!c.inStock && <div className="mt-0.5 text-[10px] text-dream-warn">Out of stock</div>}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-dream-line pt-3">
                {!colourName && <span className="text-xs text-dream-muted">Pick a colour to continue</span>}
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={!colourName} loading={pending} onClick={apply}>
                  Change to this product
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
