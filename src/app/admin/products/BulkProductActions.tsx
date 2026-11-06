"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import type { ProductRow } from "@/lib/db/rows";
import { deleteProductsAction, productsUsageAction, setProductsActiveAction } from "./actions";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * A checkbox with a 44px tap target. The label content is positioned over the
 * whole wrapper, so a near miss toggles the box instead of opening the product.
 */
export function SelectBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <Checkbox
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        label={
          <span className="absolute inset-0">
            <span className="sr-only">{label}</span>
          </span>
        }
      />
    </div>
  );
}

/** The bar above the list: Make live, Hide, Delete on what's ticked. */
export function BulkProductActions({ selected, onClear }: { selected: ProductRow[]; onClear: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"live" | "hide" | "delete" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [usage, setUsage] = useState<{ orders: number; designs: number } | null>(null);

  const ids = selected.map((p) => p.id);
  const count = selected.length;
  const noun = plural(count, "product", "products");

  async function setActive(active: boolean) {
    setBusy(active ? "live" : "hide");
    const res = await setProductsActiveAction(ids, active);
    setBusy(null);
    if (res.error) {
      toast({ title: "That didn't save", description: res.error, variant: "error" });
      return;
    }
    const changed = res.changed ?? 0;
    const skipped = res.skipped ?? [];
    toast({
      title: `${changed} ${plural(changed, "product", "products")} ${active ? "made live" : "hidden from the shop"}`,
      description: skipped.length ? `Skipped, no price list yet: ${skipped.join(", ")}` : undefined,
      variant: changed === 0 ? "error" : "success",
    });
    onClear();
  }

  function openDelete() {
    setUsage(null);
    setDeleteOpen(true);
    productsUsageAction(ids).then(setUsage).catch(() => setUsage(null));
  }

  async function confirmDelete() {
    setBusy("delete");
    const res = await deleteProductsAction(ids);
    setBusy(null);
    if (res.error) {
      toast({ title: "Delete failed", description: res.error, variant: "error" });
      return;
    }
    const deleted = res.deleted ?? 0;
    toast({ title: `${deleted} ${plural(deleted, "product", "products")} deleted`, variant: "success" });
    setDeleteOpen(false);
    onClear();
  }

  return (
    <>
      {/* Desktop: always above the list, pinned under the page header while the
          list scrolls. Phones: only once something is ticked, fixed just above
          the bottom tab bar within thumb reach. */}
      <div
        className={`fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 rounded-xl border border-dream-line bg-dream-surface p-3 md:sticky md:inset-x-auto md:bottom-auto md:top-[73px] md:z-[5] md:mb-3 md:flex md:items-center md:gap-3 ${
          count === 0 ? "hidden" : ""
        }`}
      >
        <div className="mb-2 flex items-center gap-3 md:mb-0 md:mr-auto">
          <span className="mr-auto text-sm font-medium text-dream-ink md:mr-0">{count} selected</span>
          {count > 0 && (
            <button type="button" onClick={onClear} className="text-sm font-medium text-dream-purple hover:underline">
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 md:flex">
          <Button
            variant="secondary"
            loading={busy === "live"}
            disabled={busy !== null || selected.every((p) => p.is_active)}
            onClick={() => setActive(true)}
          >
            Make live
          </Button>
          <Button
            variant="secondary"
            loading={busy === "hide"}
            disabled={busy !== null || selected.every((p) => !p.is_active)}
            onClick={() => setActive(false)}
          >
            Hide
          </Button>
          <Button variant="danger" disabled={busy !== null || count === 0} onClick={openDelete}>
            Delete
          </Button>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(o) => busy !== "delete" && setDeleteOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {count} {noun}?
            </DialogTitle>
            <DialogDescription>
              {count === 1 ? "It disappears" : "They disappear"} from the shop, the designer and this admin, along with
              print areas and pricing setup. This cannot be undone. To take {count === 1 ? "it" : "them"} out of the shop
              and keep the setup, use Hide instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 pb-4">
            <ul className="max-h-40 overflow-y-auto text-sm text-dream-ink">
              {selected.map((p) => (
                <li key={p.id} className="py-0.5">
                  {p.name}
                </li>
              ))}
            </ul>
            {usage && (usage.orders > 0 || usage.designs > 0) && (
              <p className="rounded-lg bg-dream-bg px-3 py-2 text-sm text-dream-ink">
                {usage.orders > 0 && (
                  <>
                    Used on {usage.orders} {plural(usage.orders, "order", "orders")}. Those orders stay as they are.{" "}
                  </>
                )}
                {usage.designs > 0 && (
                  <>
                    {usage.designs} saved {plural(usage.designs, "design", "designs")} will no longer open in the designer.
                  </>
                )}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy === "delete"}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === "delete"} onClick={confirmDelete}>
              Delete {count} {noun}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
