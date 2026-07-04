"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatCAD, roundCents } from "@/lib/money";
import { calcTax, isProvinceCode } from "@/lib/pricing/tax";
import { OrderItemCard } from "./OrderItemCard";
import {
  LBL,
  capitalize,
  itemQty,
  sizeRank,
  useOrderAction,
  useProofUpload,
  type Can,
  type Detail,
  type ItemState,
  type StoredAddress,
} from "./shared";
import { updateLineItemsAction, deleteLineItemAction, updateOrderPricingAction } from "../actions";
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
  const { uploading, uploadProof } = useProofUpload(order.id);
  const [view, setView] = useState<"detailed" | "compact">("detailed");

  const designById = useMemo(() => new Map(detail.designs.map((d) => [d.id, d])), [detail.designs]);
  const setupById = useMemo(() => new Map(detail.lineItems.map((li) => [li.id, li.setup_fee])), [detail.lineItems]);
  const methodOptions = Object.values(methodNames);
  const embroideryMethod = methodOptions.find((m) => /embroider/i.test(m));

  const initItems = (): ItemState[] =>
    detail.lineItems.map((li) => {
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
      };
    });

  const [items, setItems] = useState<ItemState[]>(initItems);
  const [itemsSnap, setItemsSnap] = useState(() => JSON.stringify(items));
  const itemsDirty = JSON.stringify(items) !== itemsSnap;

  const patchItem = (id: string, fn: (it: ItemState) => ItemState) =>
    setItems((arr) => arr.map((it) => (it.id === id ? fn(it) : it)));

  function saveItems() {
    run(
      () =>
        updateLineItemsAction(
          order.id,
          items.map((it) => ({
            id: it.id,
            productName: it.productName,
            sizeQuantities: Object.fromEntries(it.sizes),
            unitPrice: Number(it.unitPrice) || 0,
            decorations: { spots: it.spots, bagging: it.bagging, sewnTags: it.sewnTags, priceConfirmed: it.priceConfirmed },
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

  // --- Pricing summary ---
  const pricingCol = (order.pricing ?? {}) as { subtotal?: number; setupFees?: number; rush?: number; shipping?: number; tax?: number };
  const [price, setPrice] = useState({
    subtotal: pricingCol.subtotal ?? 0,
    setupFees: pricingCol.setupFees ?? 0,
    rush: pricingCol.rush ?? 0,
    shipping: pricingCol.shipping ?? 0,
    tax: pricingCol.tax ?? 0,
  });
  const priceTotal = roundCents(price.subtotal + price.setupFees + price.rush + price.shipping + price.tax);
  const shipProv = (order.shipping_address as StoredAddress | null)?.prov;

  function calcTaxNow() {
    const base = price.subtotal + price.setupFees + price.rush + price.shipping;
    const prov = isProvinceCode(shipProv) ? shipProv : null;
    const tax = calcTax(base, prov).total;
    setPrice((p) => ({ ...p, tax }));
  }

  const sourceArt = detail.designs.flatMap((d) => (d.source_artwork_files ?? []) as { name: string; url: string | null }[]);
  const proofsByItem = useMemo(() => {
    const m = new Map<string, typeof detail.proofs>();
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
        ? items.map((it, idx) => (
            <OrderItemCard
              key={it.id}
              item={it}
              index={idx}
              lineItem={detail.lineItems.find((l) => l.id === it.id)}
              design={(() => {
                const li = detail.lineItems.find((l) => l.id === it.id);
                return li?.design_id ? designById.get(li.design_id) : undefined;
              })()}
              methodOptions={methodOptions}
              embroideryMethod={embroideryMethod}
              can={can}
              setupFee={setupById.get(it.id) ?? 0}
              proofsForItem={proofsByItem.get(it.id) ?? []}
              uploading={uploading}
              onPatch={(fn) => patchItem(it.id, fn)}
              onRemove={() => removeItem(it.id)}
              onUploadProof={(file) => uploadProof(file, it.id)}
            />
          ))
        : (
          <Card>
            <CardContent className="divide-y divide-dream-line p-0">
              {items.map((it, idx) => {
                const li = detail.lineItems.find((l) => l.id === it.id);
                const design = li?.design_id ? designById.get(li.design_id) : undefined;
                const thumb = ((design?.mockup_images ?? []) as { url: string | null }[]).find((m) => m.url)?.url ?? null;
                const qty = itemQty(it);
                const unit = Number(it.unitPrice) || 0;
                const setup = setupById.get(it.id) ?? 0;
                const sizeSummary = it.sizes.filter(([, q]) => q > 0).map(([s, q]) => `${s}×${q}`).join("  ") || "—";
                return (
                  <div key={it.id} className="flex items-center gap-4 px-4 py-3">
                    <span className="w-5 text-sm text-dream-faint">{idx + 1}.</span>
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-dream-bg">
                      {thumb && <Image src={thumb} alt="" width={40} height={40} className="h-full w-full object-contain" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-dream-ink">{it.productName || "Untitled item"}</div>
                      <div className="truncate text-xs text-dream-muted">{sizeSummary}</div>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <div className="text-dream-muted">
                        {qty} × {formatCAD(unit)}
                      </div>
                      <div className="font-semibold text-dream-ink">{formatCAD(unit * qty + setup)}</div>
                    </div>
                    <span
                      title={it.priceConfirmed ? "Price confirmed" : "Price not confirmed"}
                      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", it.priceConfirmed ? "bg-dream-success" : "bg-dream-line-strong")}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

      {sourceArt.length > 0 && (
        <div>
          <div className={cn(LBL, "mb-1.5")}>Source artwork</div>
          <div className="flex flex-wrap gap-3">
            {sourceArt.map((a, i) =>
              a.url ? (
                <a key={i} href={a.url} target="_blank" rel="noreferrer" className="text-sm text-dream-purple underline">
                  {a.name}
                </a>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Pricing summary — invoice style */}
      <div className="flex justify-end">
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(["subtotal", "setupFees", "rush", "shipping", "tax"] as const).map((k) => (
              <label key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="capitalize text-dream-muted">
                  {k === "setupFees" ? "Setup fees" : k === "rush" ? "Rush (+50%)" : k}
                </span>
                <div className="flex items-center gap-2">
                  {k === "tax" && can.pricing && (
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={calcTaxNow} title="Fill tax from the shipping province">
                      Calc tax
                    </Button>
                  )}
                  <Input
                    type="number"
                    value={price[k]}
                    disabled={!can.pricing}
                    onChange={(e) => setPrice((p) => ({ ...p, [k]: Number(e.target.value) || 0 }))}
                    className="h-8 w-28 text-right"
                  />
                </div>
              </label>
            ))}
            <div className="flex justify-between border-t border-dream-line pt-2 font-semibold text-dream-ink">
              <span>Total</span>
              <span>{formatCAD(priceTotal)}</span>
            </div>
            {can.pricing && (
              <Button
                variant="secondary"
                className="mt-2 w-full"
                loading={pending}
                onClick={() => run(() => updateOrderPricingAction(order.id, { ...price, total: priceTotal }), "Pricing saved")}
              >
                Save pricing
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
