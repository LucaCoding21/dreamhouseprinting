"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCAD, roundCents } from "@/lib/money";
import { calcTax, isProvinceCode } from "@/lib/pricing/tax";
import { resolveDiscount, type DiscountType } from "@/lib/pricing/discount";
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

  const shipProv = (order.shipping_address as StoredAddress | null)?.prov;
  const prov = isProvinceCode(shipProv) ? shipProv : null;

  // Discount reduces the pre-tax goods (subtotal + setup + rush + add-ons); tax
  // is then computed on the discounted goods + shipping.
  const goods = price.subtotal + price.setupFees + price.rush + addons;
  const discount = resolveDiscount(goods, { discountType, discountValue });
  const total = roundCents(goods - discount + price.shipping + price.tax);

  /** Tax on the discounted base, kept in sync as base amounts or the discount change. */
  function taxFor(next: typeof price, disc: number) {
    if (!prov) return next.tax;
    const base = next.subtotal + next.setupFees + next.rush + addons - disc + next.shipping;
    return calcTax(Math.max(base, 0), prov).total;
  }

  function setField(k: PriceKey, value: number) {
    setPrice((p) => {
      const next = { ...p, [k]: value };
      // Editing any base amount re-derives tax (a manual tax edit sticks until the next base change).
      if (k !== "tax") {
        const g = next.subtotal + next.setupFees + next.rush + addons;
        next.tax = taxFor(next, resolveDiscount(g, { discountType, discountValue }));
      }
      return next;
    });
  }

  function setDiscount(type: DiscountType, value: number) {
    setDiscountType(type);
    setDiscountValue(value);
    const g = price.subtotal + price.setupFees + price.rush + addons;
    const disc = resolveDiscount(g, { discountType: type, discountValue: value });
    setPrice((p) => ({ ...p, tax: taxFor(p, disc) }));
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
      {k === "tax" && prov && (
        <p className="mt-0.5 text-right text-[11px] text-dream-faint">Auto-calculated for {prov}, edit to override</p>
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

        {editableRow("shipping")}
        {editableRow("tax")}

        <div className="flex flex-col gap-1 border-t border-dream-line pt-2">
          {discount > 0 && (
            <div className="flex justify-between text-sm text-dream-muted">
              <span>{discountLabel.trim() || "Discount"}</span>
              <span>−{formatCAD(discount)}</span>
            </div>
          )}
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
            className="mt-2 w-full"
            loading={pending}
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
                      total,
                    },
                    !!order.paid_at
                  ),
                "Pricing saved"
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
