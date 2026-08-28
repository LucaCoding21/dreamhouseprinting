"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCAD } from "@/lib/money";
import { calcTax } from "@/lib/pricing/tax";
import { resolveDiscount, type DiscountType } from "@/lib/pricing/discount";
import {
  adjustmentLabel,
  adjustmentsTotal,
  normalizeAdjustments,
  orderTotal,
  resolveTaxProvince,
  taxRateLabel,
  taxableBase,
  type PriceAdjustment,
} from "@/lib/orders/pricingMath";
import { updateOrderPricingAction } from "../actions";
import { useOrderAction, type Can, type Detail, type StoredAddress } from "./shared";

type PriceKey = "subtotal" | "setupFees" | "rush" | "shipping" | "tax";
const LABELS: Record<PriceKey, string> = {
  subtotal: "Subtotal",
  setupFees: "Setup fees",
  rush: "Rush fee",
  shipping: "Shipping",
  tax: "Tax",
};

let adjSeq = 0;
const newAdjustment = (): PriceAdjustment => ({ id: `new-${Date.now()}-${adjSeq++}`, label: "", amount: 0 });

/** Fee adds money, discount takes it off. Stored as the sign on `amount`. */
type AdjustmentKind = "fee" | "discount";

export function PricingCard({ detail, can }: { detail: Detail; can: Can }) {
  const { order } = detail;
  const { pending, run } = useOrderAction();

  const stored = (order.pricing ?? {}) as {
    subtotal?: number;
    setupFees?: number;
    rush?: number;
    addons?: number;
    shipping?: number;
    tax?: number;
    discountType?: DiscountType;
    discountValue?: number;
    discountLabel?: string;
    adjustments?: unknown;
  };
  // Add-ons are auto-computed from the line checkboxes (bagging / sewn tags / spot process), not edited here.
  const addons = stored.addons ?? 0;
  const [price, setPrice] = useState({
    subtotal: stored.subtotal ?? 0,
    setupFees: stored.setupFees ?? 0,
    rush: stored.rush ?? 0,
    shipping: stored.shipping ?? 0,
    tax: stored.tax ?? 0,
  });
  const [discountType, setDiscountType] = useState<DiscountType>(stored.discountType ?? "amount");
  const [discountValue, setDiscountValue] = useState<number>(stored.discountValue ?? 0);
  const [discountLabel, setDiscountLabel] = useState<string>(stored.discountLabel ?? "");
  const [adjustments, setAdjustments] = useState<PriceAdjustment[]>(() => normalizeAdjustments(stored.adjustments));
  // Which way a row points while its amount is still 0 (sign carries it after
  // that). Keyed by row id; seeded when a row is added via + Fee / + Discount.
  const [adjKinds, setAdjKinds] = useState<Record<string, AdjustmentKind>>({});
  const kindOf = (a: PriceAdjustment): AdjustmentKind => adjKinds[a.id] ?? (a.amount < 0 ? "discount" : "fee");

  // Save pricing greys out until something in the card actually changed. The
  // baseline is the card's mount state (the card remounts when the stored
  // pricing changes) and resets after a successful save.
  const editable = JSON.stringify({ price, discountType, discountValue, discountLabel, adjustments });
  const [savedSnap, setSavedSnap] = useState(editable);
  const dirty = editable !== savedSnap;

  // Tax follows the ship-to province; pickup and unreadable provinces fall back
  // to the shop's own province rather than charging nothing.
  const taxProv = resolveTaxProvince({
    prov: (order.shipping_address as StoredAddress | null)?.prov,
    fulfillmentMethod: order.fulfillment_method,
  });
  const prov = taxProv.code;

  // Discount reduces the pre-tax goods (subtotal + setup + rush + add-ons);
  // adjustment rows are then applied signed, and tax is computed on the result
  // plus shipping.
  const goods = price.subtotal + price.setupFees + price.rush + addons;
  const discount = resolveDiscount(goods, { discountType, discountValue });
  const adjTotal = adjustmentsTotal(adjustments);
  const total = orderTotal({ ...price, addons, discount, adjustments: adjTotal });

  /** Tax on the current base, kept in sync as amounts, the discount, or the rows change. */
  function taxFor(next: typeof price, disc: number, adj: number) {
    return calcTax(taxableBase({ ...next, addons, discount: disc, adjustments: adj }), prov).total;
  }

  function setField(k: PriceKey, value: number) {
    setPrice((p) => {
      const next = { ...p, [k]: value };
      // Editing any base amount re-derives tax (a manual tax edit sticks until the next base change).
      if (k !== "tax") {
        const g = next.subtotal + next.setupFees + next.rush + addons;
        next.tax = taxFor(next, resolveDiscount(g, { discountType, discountValue }), adjTotal);
      }
      return next;
    });
  }

  function setDiscount(type: DiscountType, value: number) {
    setDiscountType(type);
    setDiscountValue(value);
    const g = price.subtotal + price.setupFees + price.rush + addons;
    const disc = resolveDiscount(g, { discountType: type, discountValue: value });
    setPrice((p) => ({ ...p, tax: taxFor(p, disc, adjTotal) }));
  }

  function patchAdjustments(next: PriceAdjustment[]) {
    setAdjustments(next);
    setPrice((p) => ({ ...p, tax: taxFor(p, discount, adjustmentsTotal(next)) }));
  }

  const editableRow = (k: PriceKey) => (
    <div key={k}>
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="text-dream-muted">{LABELS[k]}</span>
        <Input
          type="number"
          value={price[k]}
          disabled={!can.pricing}
          onChange={(e) => setField(k, Number(e.target.value) || 0)}
          className="h-8 w-32 text-right"
        />
      </label>
      {k === "tax" && (
        <p className="mt-0.5 text-right text-[11px] text-dream-faint">
          {taxRateLabel(prov)}
          {taxProv.source === "pickup"
            ? ", pickup order"
            : taxProv.source === "fallback"
              ? ", no ship-to province on file"
              : ""}
          . Edit to override.
        </p>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pricing &amp; invoice</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {editableRow("subtotal")}
        {editableRow("setupFees")}
        {editableRow("rush")}

        {addons > 0 && (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-dream-muted">Add-ons</span>
            <span className="w-32 text-right text-dream-ink">{formatCAD(addons)}</span>
          </div>
        )}

        {/* Manual discount, a named flat amount or percentage off the goods (e.g. friends & family). */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <Input
              value={discountLabel}
              disabled={!can.pricing}
              placeholder="Discount"
              onChange={(e) => setDiscountLabel(e.target.value)}
              className="h-8 min-w-0 flex-1"
            />
            <span className="flex shrink-0 items-center gap-1.5">
              <Select
                value={discountType}
                disabled={!can.pricing}
                onChange={(e) => setDiscount(e.target.value as DiscountType, discountValue)}
                className="h-8 w-20 py-0 leading-none"
              >
                <option value="amount">$</option>
                <option value="percent">%</option>
              </Select>
              <Input
                type="number"
                min={0}
                value={discountValue || ""}
                placeholder="0"
                disabled={!can.pricing}
                onChange={(e) => setDiscount(discountType, Math.max(0, Number(e.target.value) || 0))}
                className="h-8 w-24 text-right"
              />
            </span>
          </div>
          {discount > 0 && (
            <p className="text-right text-[11px] text-dream-faint">
              −{formatCAD(discount)} off{discountType === "percent" ? ` (${Math.min(discountValue, 100)}%)` : ""}
            </p>
          )}
        </div>

        {/* Individually named fee and discount rows (per Julian). A row's sign
            is set by its Fee/Discount picker; the amount is always typed
            positive. Stored the same as before: signed `amount` on the row. */}
        <div className="space-y-1.5 border-t border-dream-line pt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-dream-muted">Discounts &amp; fees</span>
            {can.pricing && (
              <span className="flex items-center gap-2.5">
                {(["fee", "discount"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    // Negative margin keeps the row height it had before the
                    // tap padding was added.
                    className="-my-1.5 py-1.5 text-xs font-semibold text-dream-purple hover:underline"
                    onClick={() => {
                      const row = newAdjustment();
                      setAdjKinds((m) => ({ ...m, [row.id]: kind }));
                      patchAdjustments([...adjustments, row]);
                    }}
                  >
                    + {kind === "fee" ? "Fee" : "Discount"}
                  </button>
                ))}
              </span>
            )}
          </div>
          {adjustments.length === 0 && (
            <p className="text-[11px] text-dream-faint">
              None. Add a fee (delivery, rush surcharge) or a discount (loyalty, price match), each with its own name.
            </p>
          )}
          {adjustments.map((a, i) => {
            const kind = kindOf(a);
            const setRow = (patch: Partial<PriceAdjustment>) =>
              patchAdjustments(adjustments.map((row, j) => (j === i ? { ...row, ...patch } : row)));
            return (
              // Phone: the name takes the whole first line, the picker, the
              // amount, and the delete share the second. sm+ stays one row.
              <div key={a.id} className="flex flex-wrap items-center gap-1.5 text-sm sm:flex-nowrap">
                <Input
                  value={a.label}
                  disabled={!can.pricing}
                  placeholder={kind === "fee" ? "e.g. Delivery fee" : "e.g. Loyalty discount"}
                  onChange={(e) => setRow({ label: e.target.value })}
                  className="h-8 w-full min-w-0 sm:w-auto sm:flex-1"
                />
                <Select
                  value={kind}
                  disabled={!can.pricing}
                  title="A fee adds to the total, a discount takes money off"
                  onChange={(e) => {
                    const next = e.target.value as AdjustmentKind;
                    setAdjKinds((m) => ({ ...m, [a.id]: next }));
                    setRow({ amount: next === "discount" ? -Math.abs(a.amount) : Math.abs(a.amount) });
                  }}
                  className="h-8 w-24 shrink-0 py-0 leading-none"
                >
                  <option value="fee">Fee</option>
                  <option value="discount">Discount</option>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={a.amount === 0 ? "" : Math.abs(a.amount)}
                  placeholder="0.00"
                  disabled={!can.pricing}
                  onChange={(e) => {
                    const abs = Math.abs(Number(e.target.value) || 0);
                    setRow({ amount: kind === "discount" ? -abs : abs });
                  }}
                  className="h-8 w-24 shrink-0 text-right"
                />
                {can.pricing && (
                  <button
                    type="button"
                    aria-label={`Remove ${adjustmentLabel(a)}`}
                    // -m-1 p-2 grows the tap target without moving anything.
                    className="-m-1 shrink-0 rounded p-2 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
                    onClick={() => patchAdjustments(adjustments.filter((_, j) => j !== i))}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {editableRow("shipping")}
        {editableRow("tax")}

        <div className="flex flex-col gap-1 border-t border-dream-line pt-2">
          {discount > 0 && (
            <div className="flex justify-between text-sm text-dream-muted">
              <span>{discountLabel.trim() || "Discount"}</span>
              <span>−{formatCAD(discount)}</span>
            </div>
          )}
          {adjustments
            .filter((a) => a.amount !== 0)
            .map((a) => (
              <div key={`sum-${a.id}`} className="flex justify-between text-sm text-dream-muted">
                <span>{adjustmentLabel(a)}</span>
                <span>
                  {a.amount < 0 ? "−" : "+"}
                  {formatCAD(Math.abs(a.amount))}
                </span>
              </div>
            ))}
          <div className="flex justify-between font-semibold text-dream-ink">
            <span>Total</span>
            <span>{formatCAD(total)}</span>
          </div>
        </div>
        {addons > 0 && (
          <p className="text-[11px] text-dream-faint">Add-ons auto-calculated from the line options (bagging, sewn tags, spot process).</p>
        )}
        {can.pricing && (
          <Button
            variant="secondary"
            className="mt-2 w-full disabled:pointer-events-auto disabled:cursor-not-allowed"
            loading={pending}
            disabled={!dirty}
            title={dirty ? "Save the pricing changes" : "No changes to save"}
            onClick={() => {
              // Editing a paid order's pricing needs a deliberate confirm (the
              // server rejects it otherwise), a refund/top-up may be owed.
              if (order.paid_at && !window.confirm("This order is already paid. Update its pricing anyway?")) return;
              run(
                () =>
                  updateOrderPricingAction(
                    order.id,
                    {
                      ...price,
                      addons,
                      discountType,
                      discountValue,
                      discountLabel: discountLabel.trim() || undefined,
                      discount,
                      adjustments,
                      total,
                    },
                    !!order.paid_at
                  ),
                "Pricing saved",
                () => setSavedSnap(editable)
              );
            }}
          >
            Save pricing
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
