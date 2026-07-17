"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { OrderItemCard } from "./OrderItemCard";
import { CompactItemRow } from "./CompactItemRow";
import {
  capitalize,
  sizeRank,
  useOrderAction,
  type Can,
  type Detail,
  type ItemState,
  type StoredAddress,
} from "./shared";
import { DEFAULT_LINE_PRODUCTION_STATUS } from "@/lib/lineProduction";
import { updateLineItemsAction, deleteLineItemAction } from "../actions";
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
  const { pending, run } = useOrderAction();
  const [view, setView] = useState<"detailed" | "compact">("detailed");
  // Per-line collapse (detailed view) — fold individual lines when an order has many.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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

  const initItems = (): ItemState[] => {
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
        productionNotes: dec.productionNotes ?? "",
        internalNotes: dec.internalNotes ?? "",
        shippingNotes: dec.shippingNotes ?? "",
        priceSuggestion: dec.priceSuggestion ?? null,
      };
    });
  };

  const [items, setItems] = useState<ItemState[]>(initItems);
  const [itemsSnap, setItemsSnap] = useState(() => JSON.stringify(items));
  const itemsDirty = JSON.stringify(items) !== itemsSnap;

  const patchItem = (id: string, fn: (it: ItemState) => ItemState) =>
    setItems((arr) => arr.map((it) => (it.id === id ? fn(it) : it)));

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

  // Move a line up/down the queue. Persists on "Save changes" as decorations.position.
  const moveItem = (index: number, dir: -1 | 1) =>
    setItems((arr) => {
      const j = index + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = arr.slice();
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

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
              productionNotes: it.productionNotes,
              internalNotes: it.internalNotes,
              shippingNotes: it.shippingNotes,
              position: idx,
              priceSuggestion: it.priceSuggestion,
            },
          })),
        ),
      "Items saved",
      () => setItemsSnap(JSON.stringify(items)),
    );
  }

  function removeItem(id: string) {
    if (!window.confirm("Remove this item from the order?")) return;
    run(() => deleteLineItemAction(order.id, id), "Item removed", () =>
      setItems((arr) => {
        const next = arr.filter((it) => it.id !== id);
        setItemsSnap(JSON.stringify(next));
        return next;
      }),
    );
  }

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-semibold text-dream-ink">Items ({items.length})</h2>
        <div className="inline-flex overflow-hidden rounded-lg border border-dream-line">
          {(["detailed", "compact"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                view === v ? "bg-dream-purple text-white" : "bg-white text-dream-ink hover:bg-dream-bg",
              )}
            >
              {v === "detailed" ? "Detailed view" : "Compact view"}
            </button>
          ))}
        </div>
        {view === "detailed" && items.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setCollapsed(collapsed.size >= items.length ? new Set() : new Set(items.map((i) => i.id)))
            }
            className="text-sm font-medium text-dream-purple hover:underline"
          >
            {collapsed.size >= items.length ? "Expand all" : "Collapse all"}
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {itemsDirty && (
            <>
              <span className="text-sm font-medium text-dream-danger">Unsaved changes</span>
              <Button variant="ghost" onClick={() => setItems(JSON.parse(itemsSnap) as ItemState[])}>
                Discard
              </Button>
            </>
          )}
          <Button variant="primary" disabled={!can.edit || !itemsDirty} loading={pending} onClick={saveItems}>
            Save changes
          </Button>
        </div>
      </div>

      {items.length === 0 && <p className="text-sm text-dream-muted">This order has no line items.</p>}

      {view === "detailed"
        ? items.map((it, idx) => {
            const li = detail.lineItems.find((l) => l.id === it.id);
            const design = li?.design_id ? designById.get(li.design_id) : undefined;
            const product = li?.product_id ? productById.get(li.product_id) : undefined;
            if (collapsed.has(it.id)) {
              return (
                <Card key={it.id}>
                  <CardContent className="p-0">
                    <CompactItemRow
                      it={it}
                      index={idx}
                      product={product}
                      design={design}
                      setupFee={setupById.get(it.id) ?? 0}
                      onExpand={() => toggleCollapsed(it.id)}
                      onMoveUp={() => moveItem(idx, -1)}
                      onMoveDown={() => moveItem(idx, 1)}
                      isFirst={idx === 0}
                      isLast={idx === items.length - 1}
                    />
                  </CardContent>
                </Card>
              );
            }
            return (
              <OrderItemCard
                key={it.id}
                item={it}
                index={idx}
                lineItem={li}
                design={design}
                product={product}
                customerName={customerName}
                orderNumber={order.order_number}
                methodOptions={methodOptions}
                embroideryMethod={embroideryMethod}
                can={can}
                setupFee={setupById.get(it.id) ?? 0}
                proofsForItem={proofsByItem.get(it.id) ?? []}
                onPatch={(fn) => patchItem(it.id, fn)}
                onRemove={() => removeItem(it.id)}
                onProductChanged={(name, suggestion) => syncSwap(it.id, name, suggestion)}
                onCollapse={() => toggleCollapsed(it.id)}
                onMoveUp={() => moveItem(idx, -1)}
                onMoveDown={() => moveItem(idx, 1)}
                isFirst={idx === 0}
                isLast={idx === items.length - 1}
              />
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
                  <CompactItemRow
                    key={it.id}
                    it={it}
                    index={idx}
                    product={product}
                    design={design}
                    setupFee={setupById.get(it.id) ?? 0}
                    onMoveUp={() => moveItem(idx, -1)}
                    onMoveDown={() => moveItem(idx, 1)}
                    isFirst={idx === 0}
                    isLast={idx === items.length - 1}
                  />
                );
              })}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
