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
 *
 * With `colourOnly` it is "Change colour": step 1 is skipped (the line's own
 * product is pre-picked) and only the colour step shows.
 */
export function ChangeProductDialog({
  orderId,
  lineItemId,
  currentProductId,
  currentColourName,
  colourOnly = false,
  onChanged,
}: {
  orderId: string;
  lineItemId: string;
  currentProductId: string | undefined;
  /** The line's colour now, marked "Current" in the colour grid. */
  currentColourName?: string | null;
  /** Same product, new colour only (the "Change colour" link). */
  colourOnly?: boolean;
  /** Fired after a successful swap so the parent can sync its local item state. */
  onChanged: (productName: string, priceSuggestion: { unit: number; qty: number } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<SwapProduct[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<SwapProduct | null>(null);
  const [colourName, setColourName] = useState<string | null>(null);
  const [colourQuery, setColourQuery] = useState("");
  const { pending, run } = useOrderAction();

  function openDialog() {
    setPicked(null);
    setColourName(null);
    setQuery("");
    setColourQuery("");
    setLoadError(null);
    setOpen(true);
    const pickCurrent = (list: SwapProduct[]) => {
      if (!colourOnly) return;
      const current = list.find((p) => p.id === currentProductId);
      if (current) setPicked(current);
      else setLoadError("This line's product could not be found.");
    };
    if (products) pickCurrent(products);
    else {
      listSwapProductsAction().then((res) => {
        if (res.error || !res.products) setLoadError(res.error ?? "Could not load products.");
        else {
          setProducts(res.products);
          pickCurrent(res.products);
        }
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

  const filteredColours = useMemo(() => {
    if (!picked) return [];
    const q = colourQuery.trim().toLowerCase();
    if (!q) return picked.colours;
    return picked.colours.filter((c) => c.name.toLowerCase().includes(q));
  }, [picked, colourQuery]);

  function apply() {
    if (!picked || !colourName) return;
    let suggestion: { unit: number; qty: number } | null = null;
    run(
      async () => {
        const res = await changeLineItemProductAction(orderId, lineItemId, picked.id, colourName);
        if (!res.error) suggestion = res.suggestion ?? null;
        return res;
      },
      colourOnly ? "Colour changed" : "Product changed",
      () => {
        setOpen(false);
        onChanged(picked.name, suggestion);
      },
    );
  }

  return (
    <>
      <button type="button" onClick={openDialog} className="text-sm font-medium text-dream-purple hover:underline">
        {colourOnly ? "Change colour" : "Change product"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>{colourOnly ? "Change colour" : picked ? "Pick a colour" : "Change product"}</DialogTitle>
          </DialogHeader>

          {colourOnly && !picked ? (
            <p className={cn("px-5 pb-5 text-sm", loadError ? "text-dream-danger" : "text-dream-muted")}>
              {loadError ?? "Loading colours…"}
            </p>
          ) : !picked ? (
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
                      setColourQuery("");
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
                        {p.colours.length > 0 && <>, {p.colours.length} colours</>}
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
                {!colourOnly && (
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
                )}
              </div>

              <div className={LBL}>{colourOnly ? "Colour" : "Colour (required, nothing is carried over)"}</div>
              {picked.colours.length === 0 ? (
                <p className="rounded-lg border border-dream-line p-4 text-sm text-dream-muted">
                  This product has no colours configured. Set them up in the product editor first.
                </p>
              ) : (
                <>
                  <Input
                    autoFocus
                    value={colourQuery}
                    onChange={(e) => setColourQuery(e.target.value)}
                    placeholder={`Search ${picked.colours.length} colours…`}
                    aria-label="Search colours"
                  />
                  <div className="grid h-[min(50dvh,460px)] min-h-0 shrink grid-cols-2 content-start gap-1 overflow-y-auto p-1 sm:grid-cols-3">
                    {filteredColours.length === 0 && (
                      <p className="col-span-full p-3 text-sm text-dream-muted">No colours match “{colourQuery}”.</p>
                    )}
                    {filteredColours.map((c) => {
                      const selected = colourName === c.name;
                      const isCurrent = colourOnly && c.name === currentColourName;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setColourName(c.name)}
                          aria-pressed={selected}
                          className={cn(
                            "flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                            selected ? "bg-dream-bg ring-2 ring-dream-purple" : "hover:bg-dream-bg",
                          )}
                        >
                          <span
                            className="h-7 w-7 shrink-0 rounded-full border border-dream-line-strong"
                            style={swatchStyle(c)}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-dream-ink">{c.name}</span>
                            {(isCurrent || !c.inStock) && (
                              <span
                                className={cn(
                                  "block text-[11px] font-medium",
                                  isCurrent ? "text-dream-purple" : "text-dream-warn",
                                )}
                              >
                                {isCurrent ? "Current" : "Out of stock"}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-dream-line pt-3">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={!colourName || (colourOnly && colourName === currentColourName)}
                  loading={pending}
                  onClick={apply}
                >
                  {colourOnly ? "Change colour" : "Change to this product"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
