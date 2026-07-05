"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCAD, roundCents } from "@/lib/money";
import { calcTax, isProvinceCode } from "@/lib/pricing/tax";
import { updateOrderPricingAction } from "../actions";
import { useOrderAction, type Can, type Detail, type StoredAddress } from "./shared";

type PriceKey = "subtotal" | "setupFees" | "rush" | "shipping" | "tax";
const LABELS: Record<PriceKey, string> = {
  subtotal: "Subtotal",
  setupFees: "Setup fees",
  rush: "Rush (+50%)",
  shipping: "Shipping",
  tax: "Tax",
};

export function PricingCard({ detail, can }: { detail: Detail; can: Can }) {
  const { order } = detail;
  const { pending, run } = useOrderAction();

  const stored = (order.pricing ?? {}) as { subtotal?: number; setupFees?: number; rush?: number; shipping?: number; tax?: number };
  const [price, setPrice] = useState({
    subtotal: stored.subtotal ?? 0,
    setupFees: stored.setupFees ?? 0,
    rush: stored.rush ?? 0,
    shipping: stored.shipping ?? 0,
    tax: stored.tax ?? 0,
  });

  const shipProv = (order.shipping_address as StoredAddress | null)?.prov;
  const prov = isProvinceCode(shipProv) ? shipProv : null;
  const total = roundCents(price.subtotal + price.setupFees + price.rush + price.shipping + price.tax);

  function setField(k: PriceKey, value: number) {
    setPrice((p) => {
      const next = { ...p, [k]: value };
      // Editing any base amount re-derives tax (a manual tax edit sticks until the next base change).
      if (k !== "tax" && prov) {
        const base = next.subtotal + next.setupFees + next.rush + next.shipping;
        next.tax = calcTax(base, prov).total;
      }
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pricing &amp; invoice</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(["subtotal", "setupFees", "rush", "shipping", "tax"] as PriceKey[]).map((k) => (
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
              <p className="mt-0.5 text-right text-[11px] text-dream-faint">Auto-calculated for {prov} — edit to override</p>
            )}
          </div>
        ))}
        <div className="flex justify-between border-t border-dream-line pt-2 font-semibold text-dream-ink">
          <span>Total</span>
          <span>{formatCAD(total)}</span>
        </div>
        {can.pricing && (
          <Button
            variant="secondary"
            className="mt-2 w-full"
            loading={pending}
            onClick={() => run(() => updateOrderPricingAction(order.id, { ...price, total }), "Pricing saved")}
          >
            Save pricing
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
