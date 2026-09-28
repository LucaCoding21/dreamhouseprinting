"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { scrollToCenter } from "@/lib/scrollToCenter";
import { OrderItemCard } from "./OrderItemCard";
import { CompactItemRow } from "./CompactItemRow";
import { AddLineItemDialog } from "./AddLineItemDialog";
import { useLineSort } from "./useLineSort";
import {
  capitalize,
  itemQty,
  sizeRank,
  useOrderAction,
  type Can,
  type Detail,
  type ItemState,
  type StoredAddress,
} from "./shared";
import { DEFAULT_LINE_PRODUCTION_STATUS } from "@/lib/lineProduction";
import { updateLineItemsAction, deleteLineItemAction } from "../actions";
import { breakdownUnitPrice, toDrafts } from "@/lib/orders/priceBreakdown";
import type { DecorationSpot, LineItemDecorations } from "../actions";

export function OrderItemsSection({
  detail,
  methodNames,
  can,
}: {
  detail: Detail;
  methodNames: Record<string, string>;
  can: Can;
}) {
  const { order } = detail;
  const router = useRouter();
  const { pending, run } = useOrderAction();
  const [view, setView] = useState<"detailed" | "compact">("detailed");
  const [addOpen, setAddOpen] = useState(false);
  // The line the admin is about to delete. A real dialog, not window.confirm:
  // native confirms are suppressed outright in some contexts (Chrome's "prevent
  // this page from creating additional dialogs" makes every later confirm
  // return false), which turned the delete X into a silent no-op.
  const [removing, setRemoving] = useState<ItemState | null>(null);
  // Per-line collapse (detailed view), fold individual lines when an order has many.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // "Go to item": the typed number, and the line briefly ringed after a jump.
  const { toast } = useToast();
  const [jumpTo, setJumpTo] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);
  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const shipName = (order.shipping_address as StoredAddress | null)?.name;
  const customerName = detail.customer?.name ?? shipName ?? order.guest_email ?? "the customer";

  const designById = useMemo(() => new Map(detail.designs.map((d) => [d.id, d])), [detail.designs]);
  const setupById = useMemo(() => new Map(detail.lineItems.map((li) => [li.id, li.setup_fee])), [detail.lineItems]);
  const productById = useMemo(() => new Map(detail.products.map((p) => [p.id, p])), [detail.products]);
  const methodOptions = Object.values(methodNames);
  const embroideryMethod = methodOptions.find((m) => /embroider/i.test(m));
  // "Add print" used to pass methodOptions[0], i.e. whatever decoration method
  // happened to sort first by display_order. That is Embroidery, so the button
  // added an embroidery spot: it priced the line on the embroidery curve and
  // made ink colours free. Look the method up by name, like embroidery does.
  const printMethod =
    methodOptions.find((m) => /screen/i.test(m)) ??
    methodOptions.find((m) => !/embroider/i.test(m)) ??
    methodOptions[0];

  const initItems = useCallback((): ItemState[] => {
    // Honour the saved manual queue order; legacy lines fall back to insertion order.
    const ordered = detail.lineItems
      .map((li, i) => {
        const dec = (li.decorations ?? {}) as Partial<LineItemDecorations>;
        return { li, pos: typeof dec.position === "number" ? dec.position : i };
      })
      .sort((a, b) => a.pos - b.pos)
      .map((x) => x.li);
    return ordered.map((li) => {
      const dec = (li.decorations ?? {}) as Partial<LineItemDecorations>;
      const design = li.design_id ? designById.get(li.design_id) : undefined;
      const views = ((design?.mockup_images ?? []) as { view: string; url: string | null }[]).map((m) => m.view);
      const methodName = li.decoration_method_id ? methodNames[li.decoration_method_id] ?? "" : "";
      const spots: DecorationSpot[] =
        dec.spots && dec.spots.length > 0
          ? dec.spots
          : (views.length ? views : ["front"]).map((v) => ({
              location: capitalize(v),
              type: methodName,
              widthIn: "",
              heightIn: "",
              colours: "",
              pantones: [],
              puff: false,
              spotProcess: false,
            }));
      const sq = (li.size_quantities ?? {}) as Record<string, number>;
      const sizes = Object.entries(sq).sort(([a], [b]) => sizeRank(a) - sizeRank(b));
      return {
        id: li.id,
        productName: li.product_name ?? "",
        sizes,
        unitPrice: String(li.unit_price),
        spots,
        bagging: !!dec.bagging,
        sewnTags: !!dec.sewnTags,
        priceConfirmed: !!dec.priceConfirmed,
        productionStatus: dec.productionStatus ?? DEFAULT_LINE_PRODUCTION_STATUS,
        customerNotes: dec.customerNotes ?? "",
        productionNotes: dec.productionNotes ?? "",
        internalNotes: dec.internalNotes ?? "",
        shippingNotes: dec.shippingNotes ?? "",
        fulfilled: !!dec.fulfilled,
        supplier: dec.supplier ?? "",
        priceSuggestion: dec.priceSuggestion ?? null,
        priceCharges: toDrafts(dec.priceCharges),
      };
    });
  }, [detail.lineItems, designById, methodNames]);

  const [items, setItems] = useState<ItemState[]>(initItems);
  const [itemsSnap, setItemsSnap] = useState(() => JSON.stringify(items));
  const itemsDirty = JSON.stringify(items) !== itemsSnap;

  // Items are seeded ONCE, so a line added (or removed) server-side would never
  // appear until a full page load. Re-seed when the SET of line ids changes, and
  // only when there is nothing unsaved: a refresh must never wipe an edit in
  // progress. Field-level server changes are deliberately not picked up here.
  // React's documented "adjust state when props change" pattern (a render-phase
  // setState, re-run immediately, no extra paint) rather than an effect, which
  // would flash the stale list first.
  const lineIdKey = detail.lineItems.map((li) => li.id).sort().join(",");
  const [seededIds, setSeededIds] = useState(lineIdKey);
  if (lineIdKey !== seededIds && !itemsDirty) {
    const fresh = initItems();
    setItems(fresh);
    setItemsSnap(JSON.stringify(fresh));
    setSeededIds(lineIdKey);
  }

  // A line priced from a breakdown keeps its unit price in step with the
  // charges AND the quantity (one-time charges spread over the pieces).
  const withBreakdown = (it: ItemState): ItemState =>
    it.priceCharges.length > 0
      ? { ...it, unitPrice: breakdownUnitPrice(it.priceCharges, itemQty(it)).toFixed(2), autoPrice: null }
      : it;

  const patchItem = (id: string, fn: (it: ItemState) => ItemState) =>
    setItems((arr) => arr.map((it) => (it.id === id ? withBreakdown(fn(it)) : it)));

  // A product swap persists server-side immediately; sync the new name and
  // price suggestion into BOTH the live state and the snapshot so they don't
  // read as unsaved edits (and a later "Save changes" can't write stale values
  // back). Applying/dismissing the suggestion later IS a normal unsaved edit.
  const syncSwap = (id: string, name: string, priceSuggestion: { unit: number; qty: number } | null) => {
    const apply = (arr: ItemState[]) =>
      arr.map((it) => (it.id === id ? { ...it, productName: name, priceSuggestion } : it));
    setItems(apply);
    setItemsSnap((snap) => JSON.stringify(apply(JSON.parse(snap) as ItemState[])));
  };

  // Move a line to a new position; the lines in between shift one place
  // (4 -> 2 bumps 2 and 3 down to 3 and 4). Persists on "Save changes" as
  // decorations.position. The moved line is ringed and scrolled to, since a
  // typed jump sends it somewhere off screen.
  const moveItem = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const moved = items[from];
    setItems((arr) => {
      const next = arr.slice();
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
    setFlashId(moved.id);
    setTimeout(() => setFlashId((id) => (id === moved.id ? null : id)), 1600);
    requestAnimationFrame(() =>
      scrollToCenter(document.getElementById(`order-item-${to + 1}`)),
    );
  };

  // Drag to reorder: grabbing a grip swaps the list for short rows until the
  // pointer is released (see useLineSort).
  const { listRef: sortListRef, sort: sortState, start: startSort, rowStyle: sortRowStyle } = useLineSort(items.length);
  const positionProps = (idx: number, id: string) =>
    can.edit
      ? {
          total: items.length,
          onMove: (to: number) => moveItem(idx, to),
          onGripPointerDown: (e: React.PointerEvent) => startSort(id, idx, e, moveItem),
        }
      : { total: items.length };

  function saveItems() {
    run(
      () =>
        updateLineItemsAction(
          order.id,
          items.map((it, idx) => ({
            id: it.id,
            productName: it.productName,
            sizeQuantities: Object.fromEntries(it.sizes.filter(([, q]) => q > 0)),
            unitPrice: Number(it.unitPrice) || 0,
            decorations: {
              spots: it.spots,
              bagging: it.bagging,
              sewnTags: it.sewnTags,
              priceConfirmed: it.priceConfirmed,
              productionStatus: it.productionStatus,
              customerNotes: it.customerNotes,
              productionNotes: it.productionNotes,
              internalNotes: it.internalNotes,
              shippingNotes: it.shippingNotes,
              fulfilled: it.fulfilled,
              supplier: it.supplier,
              position: idx,
              priceSuggestion: it.priceSuggestion,
              priceCharges: it.priceCharges.map((c) => ({ ...c, amount: Number(c.amount) || 0 })),
            },
          })),
        ),
      "Items saved",
      () => setItemsSnap(JSON.stringify(items)),
    );
  }

  function confirmRemove() {
    const id = removing?.id;
    if (!id) return;
    run(() => deleteLineItemAction(order.id, id), "Item removed", () => {
      setItems((arr) => arr.filter((it) => it.id !== id));
      // Drop the line from the SNAPSHOT too, rather than overwriting it with
      // the current items: unsaved edits on the other lines stay unsaved
      // (overwriting greyed out Save and stranded them).
      setItemsSnap((snap) => JSON.stringify((JSON.parse(snap) as ItemState[]).filter((it) => it.id !== id)));
      setSeededIds((key) => key.split(",").filter((k) => k !== id).join(","));
      setRemoving(null);
    });
  }

  // Curve tiers price on the COMBINED quantity of every line that shares a
  // design (a two-colourway job of 15 + 15 pieces is priced as 30), which is how
  // the designer priced it at placement. Lines with no design price on their own
  // quantity. Read off the LIVE item state so an edit on one colourway is
  // reflected the moment its sibling is repriced.
  const designIdByItem = useMemo(
    () => new Map(detail.lineItems.map((li) => [li.id, li.design_id])),
    [detail.lineItems],
  );
  const siblingQty = (id: string) => {
    const designId = designIdByItem.get(id) ?? null;
    if (!designId) return 0;
    return items.reduce(
      (sum, other) => (other.id !== id && designIdByItem.get(other.id) === designId ? sum + itemQty(other) : sum),
      0,
    );
  };

  const proofsByItem = useMemo(() => {
    const m = new Map<string, Detail["proofs"]>();
    for (const p of detail.proofs) {
      if (!p.line_item_id) continue;
      const arr = m.get(p.line_item_id) ?? [];
      arr.push(p);
      m.set(p.line_item_id, arr);
    }
    return m;
  }, [detail.proofs]);

  /** Bring item N (the number shown on each line) to the TOP of the list, so
   *  it's right there to work on instead of the page scrolling off to it. The
   *  lines above it shift down one, same as typing 1 into its number box. */
  function goToItem(e: React.FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(jumpTo, 10);
    if (!Number.isFinite(n) || n < 1 || n > items.length) {
      toast({ title: `Pick an item from 1 to ${items.length}`, variant: "error" });
      return;
    }
    const target = items[n - 1];
    if (collapsed.has(target.id)) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
    }
    setJumpTo("");
    if (n > 1) {
      moveItem(n - 1, 0);
      return;
    }
    setFlashId(target.id);
    setTimeout(() => setFlashId((id) => (id === target.id ? null : id)), 1600);
    requestAnimationFrame(() => scrollToCenter(document.getElementById("order-item-1")));
  }

  // After "Add item", the new line arrives with the server refresh. Remember
  // which lines existed before, then scroll to the one that wasn't there.
  const idsBeforeAdd = useRef<Set<string> | null>(null);
  useEffect(() => {
    const before = idsBeforeAdd.current;
    if (!before) return;
    const idx = items.findIndex((it) => !before.has(it.id));
    if (idx < 0) return;
    idsBeforeAdd.current = null;
    requestAnimationFrame(() =>
      scrollToCenter(document.getElementById(`order-item-${idx + 1}`)),
    );
  }, [items]);

  const itemAnchor = (idx: number, id: string) => ({
    id: `order-item-${idx + 1}`,
    className: cn(
      "relative scroll-mt-4 rounded-xl transition-[box-shadow,opacity] duration-500",
      flashId === id && "ring-4 ring-dream-purple/40",
    ),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-semibold text-dream-ink">Items ({items.length})</h2>
        {/* Same 32px height and type as the size="sm" Button beside it, so the
            toolbar reads as one row of controls. */}
        <div className="inline-flex h-8 overflow-hidden rounded-lg border border-dream-line">
          {(["detailed", "compact"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "px-3 text-[14px] font-medium transition-colors",
                view === v ? "bg-dream-purple text-white" : "bg-white text-dream-ink hover:bg-dream-bg",
              )}
            >
              {v === "detailed" ? "Detailed view" : "Compact view"}
            </button>
          ))}
        </div>
        {can.edit && (
          // Adding writes straight to the DB and the list re-seeds from the
          // server, so unsaved edits have to be settled first or they'd be lost.
          <Button
            variant="secondary"
            size="sm"
            disabled={itemsDirty}
            title={itemsDirty ? "Save or discard your changes first" : "Add another product or a custom item"}
            className="border-dream-purple/40 text-dream-purple hover:bg-dream-lavender-mist disabled:pointer-events-auto disabled:cursor-not-allowed"
            onClick={() => setAddOpen(true)}
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add item
          </Button>
        )}
        {view === "detailed" && items.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setCollapsed(collapsed.size >= items.length ? new Set() : new Set(items.map((i) => i.id)))
            }
            className="py-1 text-sm font-medium text-dream-purple hover:underline"
          >
            {collapsed.size >= items.length ? "Expand all" : "Collapse all"}
          </button>
        )}
        {/* Every artwork and mockup on the order, stacked on one printable page. */}
        <a
          href={`/admin/orders/${order.id}/artwork`}
          target="_blank"
          rel="noreferrer"
          className="py-1 text-sm font-medium text-dream-purple hover:underline"
        >
          All artwork on one page
        </a>
        <div className="ml-auto flex items-center gap-3">
          {/* Type a number, press Enter: that item moves to the top of the list. */}
          {items.length > 1 && (
            <form onSubmit={goToItem}>
              <Input
                aria-label="Move item number to the top"
                title="Type an item number and press Enter to move it to the top"
                value={jumpTo}
                inputMode="numeric"
                placeholder="Move # to top"
                onChange={(e) => setJumpTo(e.target.value.replace(/[^\d]/g, ""))}
                className="h-9 w-32 px-2 text-center"
              />
            </form>
          )}
          {itemsDirty && (
            <>
              <span className="text-sm font-medium text-dream-danger">Unsaved changes</span>
              <Button variant="ghost" onClick={() => setItems(JSON.parse(itemsSnap) as ItemState[])}>
                Discard
              </Button>
            </>
          )}
          {/* Greyed out until something actually changed. pointer-events stay on
              so the disabled state reads as not-allowed instead of dead. */}
          <Button
            variant="primary"
            disabled={!can.edit || !itemsDirty}
            loading={pending}
            title={itemsDirty ? "Save the line edits" : "No changes to save"}
            className="disabled:pointer-events-auto disabled:cursor-not-allowed"
            onClick={saveItems}
          >
            Save changes
          </Button>
        </div>
      </div>

      {/* Phone: the header Save sits a long way above the line being edited, so
          mirror it in a floating bar. bottom-20 clears the mobile tab bar. */}
      {itemsDirty && (
        <div className="fixed inset-x-4 bottom-20 z-30 flex items-center justify-between gap-3 rounded-xl border border-dream-line bg-dream-surface px-4 py-2.5 shadow-lg sm:hidden">
          <span className="text-xs font-medium text-dream-danger">Unsaved changes</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setItems(JSON.parse(itemsSnap) as ItemState[])}>
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!can.edit}
              loading={pending}
              title={can.edit ? "Save the line edits" : "You cannot edit this order"}
              onClick={saveItems}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 && <p className="text-sm text-dream-muted">This order has no line items.</p>}

      {sortState ? (
        // Reorder mode: every line as one short row, so the whole order fits
        // on screen while dragging, whatever size the cards are.
        <div ref={sortListRef} className="space-y-2">
          {items.map((it, idx) => {
            const li = detail.lineItems.find((l) => l.id === it.id);
            const design = li?.design_id ? designById.get(li.design_id) : undefined;
            const product = li?.product_id ? productById.get(li.product_id) : undefined;
            const grabbed = sortState?.id === it.id;
            return (
              <div
                key={it.id}
                data-sort-row
                style={sortRowStyle(idx)}
                className={cn(
                  "rounded-xl border bg-dream-surface transition-shadow",
                  grabbed
                    ? "border-dream-purple shadow-[0_12px_28px_-10px_rgba(27,20,88,0.35)] ring-2 ring-dream-purple/30"
                    : "border-dream-line",
                )}
              >
                <CompactItemRow
                  it={it}
                  index={idx}
                  product={product}
                  design={design}
                  proofsForItem={proofsByItem.get(it.id) ?? []}
                  orderNumber={order.order_number}
                  orderStatus={order.status}
                  setupFee={setupById.get(it.id) ?? 0}
                  {...positionProps(idx, it.id)}
                />
              </div>
            );
          })}
        </div>
      ) : view === "detailed"
        ? items.map((it, idx) => {
            const li = detail.lineItems.find((l) => l.id === it.id);
            const design = li?.design_id ? designById.get(li.design_id) : undefined;
            const product = li?.product_id ? productById.get(li.product_id) : undefined;
            if (collapsed.has(it.id)) {
              return (
                <div key={it.id} {...itemAnchor(idx, it.id)}>
                <Card>
                  <CardContent className="p-0">
                    <CompactItemRow
                      it={it}
                      index={idx}
                      product={product}
                      design={design}
                      proofsForItem={proofsByItem.get(it.id) ?? []}
                      orderNumber={order.order_number}
                      orderStatus={order.status}
                      setupFee={setupById.get(it.id) ?? 0}
                      onExpand={() => toggleCollapsed(it.id)}
                      onRemove={can.edit ? () => setRemoving(it) : undefined}
                      {...positionProps(idx, it.id)}
                    />
                  </CardContent>
                </Card>
                </div>
              );
            }
            return (
              <div key={it.id} {...itemAnchor(idx, it.id)}>
              <OrderItemCard
                item={it}
                index={idx}
                lineItem={li}
                design={design}
                product={product}
                customerName={customerName}
                orderNumber={order.order_number}
                methodOptions={methodOptions}
                embroideryMethod={embroideryMethod}
                printMethod={printMethod}
                can={can}
                setupFee={setupById.get(it.id) ?? 0}
                pricingSettings={detail.decorationPricing}
                siblingQty={siblingQty(it.id)}
                proofsForItem={proofsByItem.get(it.id) ?? []}
                onPatch={(fn) => patchItem(it.id, fn)}
                onRemove={() => setRemoving(it)}
                onProductChanged={(name, suggestion) => syncSwap(it.id, name, suggestion)}
                onCollapse={() => toggleCollapsed(it.id)}
                {...positionProps(idx, it.id)}
              />
              </div>
            );
          })
        : (
          <Card>
            <CardContent className="divide-y divide-dream-line p-0">
              {items.map((it, idx) => {
                const li = detail.lineItems.find((l) => l.id === it.id);
                const design = li?.design_id ? designById.get(li.design_id) : undefined;
                const product = li?.product_id ? productById.get(li.product_id) : undefined;
                return (
                  <div key={it.id} {...itemAnchor(idx, it.id)}>
                  <CompactItemRow
                    it={it}
                    index={idx}
                    product={product}
                    design={design}
                    proofsForItem={proofsByItem.get(it.id) ?? []}
                    orderNumber={order.order_number}
                    orderStatus={order.status}
                    setupFee={setupById.get(it.id) ?? 0}
                    onRemove={can.edit ? () => setRemoving(it) : undefined}
                    {...positionProps(idx, it.id)}
                  />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}


      {can.edit && (
        <AddLineItemDialog
          orderId={order.id}
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdded={() => {
            // A brand new line needs its size run typed in, so land on the
            // editable card: expanded, and out of Compact view if that's where
            // the admin was. The list itself re-seeds off the refreshed data.
            setCollapsed(new Set());
            setView("detailed");
            idsBeforeAdd.current = new Set(items.map((it) => it.id));
            router.refresh();
          }}
        />
      )}

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this item from the order?</DialogTitle>
            <DialogDescription>
              &ldquo;{removing?.productName || "Untitled item"}&rdquo; is deleted from this order and the totals are
              recalculated. Any proof filed against it stays on the order. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={pending} onClick={confirmRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
