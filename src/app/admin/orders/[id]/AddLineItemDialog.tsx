"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import { ProductPickerDialog } from "../new/ProductPickerDialog";
import { ColourPickerDialog } from "../new/ColourPickerDialog";
import { addLineItemAction, listCatalogProductsAction } from "../actions";
import type { CatalogProduct } from "../new/shared";
import type { AddLineItemInput } from "../actions";

/**
 * Add a line to an order that already exists (Julian: "how do I add new lines
 * and products to the order on customer submitted orders?").
 *
 * "Add item" lands straight on the visual product picker (Julian didn't want a
 * chooser step in front of it). Picking a garment goes on to its colours and
 * picking a colour adds the line, no confirm; a one-colour product skips the
 * colour step too. The picker's pinned "Custom product" tile opens the only
 * form left here: a name for off-catalog work. The line lands empty; sizes and
 * the price are filled in on the normal line card, where the auto-reprice
 * already reads the product's curve.
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
  const [step, setStep] = useState<"product" | "colour" | "custom">("product");
  const [products, setProducts] = useState<CatalogProduct[] | null>(null);
  const [productId, setProductId] = useState("");
  const [customName, setCustomName] = useState("");
  const [pending, start] = useTransition();
  // The pickers close themselves right after onPick, so their onOpenChange(false)
  // fires on a pick too. This marks "moved on to the next step, not dismissed".
  const advanced = useRef(false);

  const product = products?.find((p) => p.id === productId) ?? null;

  // The catalog carries every colourway of every product, so it is fetched on
  // the first open rather than with the order. The picker shows a spinner until
  // it lands.
  useEffect(() => {
    if (!open || products) return;
    let live = true;
    listCatalogProductsAction().then((res) => {
      if (!live) return;
      if (res.error || !res.products) {
        toast({ title: "Could not load the catalog", description: res.error, variant: "error" });
        onOpenChange(false);
        return;
      }
      setProducts(res.products);
    });
    return () => {
      live = false;
    };
  }, [open, products, toast, onOpenChange]);

  function close() {
    onOpenChange(false);
    // Reset after the close so the next "Add item" starts on the picker again.
    setStep("product");
    setProductId("");
    setCustomName("");
  }

  /** Dismissing a picker (X, Esc, backdrop) ends the flow; a pick doesn't. */
  function pickerClosed(o: boolean) {
    if (o) return;
    if (advanced.current) {
      advanced.current = false;
      return;
    }
    close();
  }

  function add(input: AddLineItemInput) {
    start(async () => {
      const res = await addLineItemAction(orderId, input);
      if (res.error) {
        toast({ title: "Could not add the item", description: res.error, variant: "error" });
        return;
      }
      toast({ title: "Item added", description: "Fill in the size run to price it.", variant: "success" });
      close();
      onAdded();
    });
  }

  function addCatalog(p: CatalogProduct, colourName: string) {
    const colour = p.colours.find((c) => c.name === colourName);
    add({
      kind: "catalog",
      productId: p.id,
      productName: p.name,
      colourName,
      colourHex: colour?.hex ?? null,
    });
  }

  function pickProduct(id: string) {
    const p = products?.find((x) => x.id === id);
    if (!p) return;
    advanced.current = true;
    setProductId(id);
    setStep("colour");
    // Nothing to choose; add it now. The flow closes once the line is in.
    if (p.colours.length === 1) addCatalog(p, p.colours[0].name);
  }

  const colourStepOpen = open && step === "colour" && !!product && product.colours.length !== 1;

  return (
    <>
      <ProductPickerDialog
        open={open && step === "product"}
        onOpenChange={pickerClosed}
        products={products ?? []}
        loading={!products}
        currentId={productId}
        onPick={pickProduct}
        onPickCustom={() => {
          advanced.current = true;
          setStep("custom");
        }}
      />

      {product && (
        <ColourPickerDialog
          open={colourStepOpen}
          onOpenChange={(o) => {
            if (o) return;
            // A colour pick adds the line (close() runs when it's in); a
            // dismiss goes back to the product grid instead of losing the flow.
            if (advanced.current) {
              advanced.current = false;
              return;
            }
            setStep("product");
          }}
          productName={product.name}
          colours={product.colours}
          currentName=""
          onPick={(name) => {
            advanced.current = true;
            addCatalog(product, name);
          }}
        />
      )}

      <Dialog open={open && step === "custom"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a custom item</DialogTitle>
            <DialogDescription>
              Off-catalog work: no garment, no price list. Set the price by hand on the item card.
            </DialogDescription>
          </DialogHeader>

          <form
            id="add-custom-item"
            className="p-5 pt-0"
            onSubmit={(e) => {
              e.preventDefault();
              const name = customName.trim();
              if (!name) return;
              add({ kind: "custom", productId: null, productName: name, colourName: null, colourHex: null });
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-dream-ink">What is it?</span>
              <Input
                autoFocus
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Vinyl banner, 3ft x 6ft"
              />
            </label>
          </form>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setStep("product")}>
              Back
            </Button>
            <Button
              type="submit"
              form="add-custom-item"
              variant="primary"
              disabled={!customName.trim()}
              loading={pending}
            >
              Add to order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
