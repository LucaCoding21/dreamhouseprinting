"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { swatchStyle } from "@/lib/swatch";
import { ProductPickerDialog } from "../new/ProductPickerDialog";
import { ColourPickerDialog } from "../new/ColourPickerDialog";
import { addLineItemAction, listCatalogProductsAction } from "../actions";
import type { CatalogProduct } from "../new/shared";

/**
 * Add a line to an order that already exists (Julian: "how do I add new lines
 * and products to the order on customer submitted orders?").
 *
 * Two modes: a catalog garment picked off the same visual pickers the
 * manual-order screen uses, or a freeform description for an off-catalog job.
 * The line lands empty; sizes and the price are filled in on the normal line
 * card, where the auto-reprice already reads the product's curve.
 */
export function AddLineItemDialog({
  orderId,
  open,
  onOpenChange,
  onAdded,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The line was created server-side; the caller refreshes the order data. */
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"catalog" | "custom">("catalog");
  const [products, setProducts] = useState<CatalogProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [productId, setProductId] = useState("");
  const [colourName, setColourName] = useState("");
  const [customName, setCustomName] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [colourOpen, setColourOpen] = useState(false);
  const [pending, start] = useTransition();

  const product = products?.find((p) => p.id === productId) ?? null;
  const colour = product?.colours.find((c) => c.name === colourName) ?? null;

  /** The catalog carries every colourway of every product, so it is fetched on
   *  demand (first time the picker is opened) rather than with the order. */
  async function openPicker() {
    if (products) {
      setPickerOpen(true);
      return;
    }
    setLoading(true);
    const res = await listCatalogProductsAction();
    setLoading(false);
    if (res.error || !res.products) {
      toast({ title: "Could not load the catalog", description: res.error, variant: "error" });
      return;
    }
    setProducts(res.products);
    setPickerOpen(true);
  }

  function reset() {
    setProductId("");
    setColourName("");
    setCustomName("");
  }

  const ready = mode === "catalog" ? !!productId && !!colourName : !!customName.trim();

  function submit() {
    if (!ready) return;
    start(async () => {
      const res = await addLineItemAction(orderId, {
        kind: mode,
        productId: mode === "catalog" ? productId : null,
        productName: mode === "catalog" ? product?.name ?? "" : customName.trim(),
        colourName: mode === "catalog" ? colourName : null,
        colourHex: mode === "catalog" ? colour?.hex ?? null : null,
      });
      if (res.error) {
        toast({ title: "Could not add the item", description: res.error, variant: "error" });
        return;
      }
      toast({ title: "Item added", description: "Fill in the size run to price it.", variant: "success" });
      reset();
      onOpenChange(false);
      onAdded();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an item to this order</DialogTitle>
            <DialogDescription>
              The line is added empty. Type the size run on the item card and the price fills in from this
              product&apos;s price list.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-5 pt-0">
            <div className="inline-flex overflow-hidden rounded-lg border border-dream-line">
              {(["catalog", "custom"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium transition-colors",
                    mode === m ? "bg-dream-purple text-white" : "bg-white text-dream-ink hover:bg-dream-bg",
                  )}
                >
                  {m === "catalog" ? "From catalog" : "Custom item"}
                </button>
              ))}
            </div>

            {mode === "catalog" ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={loading}
                  className="flex w-full items-center gap-3 rounded-xl border border-dream-line p-3 text-left transition-colors hover:border-dream-purple disabled:opacity-60"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-dream-bg">
                    {loading ? (
                      <Spinner className="text-dream-purple" />
                    ) : product?.colours.find((c) => c.images?.front)?.images?.front ? (
                      <Image
                        src={product.colours.find((c) => c.images?.front)!.images!.front!}
                        alt=""
                        width={56}
                        height={56}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-dream-faint">No photo</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-dream-ink">
                      {product ? product.name : "Choose a product"}
                    </span>
                    <span className="block truncate text-xs text-dream-muted">
                      {product
                        ? [product.brand, product.ssStyleName].filter(Boolean).join(" ") || "No S&S style"
                        : "Search the catalog, hidden products included"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-dream-purple">
                    {product ? "Change" : "Pick"}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!product}
                  onClick={() => setColourOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl border border-dream-line p-3 text-left transition-colors hover:border-dream-purple disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    aria-hidden
                    className="h-6 w-6 shrink-0 rounded-full border border-dream-line-strong"
                    style={swatchStyle({ name: colour?.name ?? "", hex: colour?.hex ?? null })}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-dream-ink">
                    {colour ? colour.name : product ? "Choose a colour" : "Pick a product first"}
                  </span>
                  {product && <span className="shrink-0 text-sm font-medium text-dream-purple">Pick</span>}
                </button>
              </div>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-dream-ink">What is it?</span>
                <Input
                  autoFocus
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Vinyl banner, 3ft x 6ft"
                />
                <span className="block text-xs text-dream-muted">
                  Off-catalog work: no garment, no price list. Set the price by hand on the item card.
                </span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!ready} loading={pending} onClick={submit}>
              Add to order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {products && (
        <ProductPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          products={products}
          currentId={productId}
          onPick={(id) => {
            setProductId(id);
            // The colours never map across products, so nothing is carried over.
            setColourName("");
          }}
        />
      )}
      {product && (
        <ColourPickerDialog
          open={colourOpen}
          onOpenChange={setColourOpen}
          productName={product.name}
          colours={product.colours}
          currentName={colourName}
          onPick={setColourName}
        />
      )}
    </>
  );
}
