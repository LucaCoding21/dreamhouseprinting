"use client";

import Image from "next/image";
import { formatCAD } from "@/lib/money";
import { calcTax, type ProvinceCode } from "@/lib/pricing/tax";
import { rushFee } from "@/lib/pricing/rush";

export interface SummaryColorway {
  colourName: string | null;
  colourHex: string | null;
  sizeBreakdown: { size: string; qty: number }[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CheckoutSummary {
  designName: string;
  productName: string;
  brand: string | null;
  colorways: SummaryColorway[];
  quantity: number; // total across all colourways
  mockupUrl: string | null;
  subtotal: number;
  setup: number;
}

function ratePct(rate: number): string {
  return `${(rate * 100).toFixed(3).replace(/\.?0+$/, "")}%`;
}

/**
 * Sticky order-summary card shared by both checkout steps. Tax is computed live
 * from `province` (null -> "Calculating…"). `shippingLabel` lets the contact
 * step show "Next step" while the shipping step shows "Free".
 */
export function OrderSummary({
  summary,
  province,
  shippingLabel,
  rush = false,
}: {
  summary: CheckoutSummary;
  province: ProvinceCode | null;
  shippingLabel?: React.ReactNode;
  /** Reflect the rush turnaround surcharge (50% of goods + setup) live. */
  rush?: boolean;
}) {
  const rushAmount = rushFee(summary.subtotal, summary.setup, rush);
  const taxableBase = summary.subtotal + summary.setup + rushAmount;
  const tax = calcTax(taxableBase, province);
  const total = taxableBase + tax.total;

  return (
    <div className="rounded-2xl border border-dream-line bg-white p-6 lg:sticky lg:top-24">
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-dream-muted">Order summary</h2>

      {/* Line item */}
      <div className="mt-4 flex gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white">
          {summary.mockupUrl ? (
            <Image src={summary.mockupUrl} alt={summary.designName} fill className="object-contain" sizes="80px" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-dream-faint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="8.5" cy="9.5" r="1.5" />
                <path d="M4 16l4.5-4 3.5 3 3-3 5 5" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold">{summary.designName}</p>
          <p className="truncate text-xs text-dream-muted">
            {summary.productName}
            {summary.brand ? ` · ${summary.brand}` : ""}
          </p>
          <div className="mt-1.5 space-y-1.5">
            {summary.colorways.map((cw, i) => (
              <div key={i}>
                <p className="flex items-center gap-1.5 text-xs text-dream-muted">
                  {cw.colourHex && (
                    <span className="inline-block h-3 w-3 rounded-full border border-dream-line" style={{ backgroundColor: cw.colourHex }} />
                  )}
                  {cw.colourName ?? "—"} · {cw.quantity} {cw.quantity === 1 ? "item" : "items"}
                </p>
                {cw.sizeBreakdown.length > 0 && (
                  <p className="mt-0.5 text-[11px] text-dream-faint">
                    {cw.sizeBreakdown.map((s) => `${s.size}×${s.qty}`).join("  ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <hr className="my-4 border-dream-line" />

      <dl className="space-y-2 text-sm">
        <Row label="Subtotal" value={formatCAD(summary.subtotal)} />
        {summary.setup > 0 && <Row label="Setup fees" value={formatCAD(summary.setup)} />}
        {rushAmount > 0 && <Row label="Rush (+50%)" value={formatCAD(rushAmount)} />}

        {province ? (
          tax.lines.map((l) => <Row key={l.label} label={`${l.label} (${ratePct(l.rate)})`} value={formatCAD(l.amount)} />)
        ) : (
          <Row label="Tax" value={<span className="text-dream-faint">Calculating…</span>} />
        )}

        <Row label="Shipping" value={shippingLabel ?? <span className="text-dream-faint">Next step</span>} />
      </dl>

      <hr className="my-4 border-dream-line" />

      <div className="flex items-baseline justify-between">
        <span className="font-display text-base font-bold">Total</span>
        <span className="text-right">
          <span className="font-display text-xl font-extrabold text-dream-purple">{formatCAD(total)}</span>
          <span className="ml-1 text-xs text-dream-faint">CAD</span>
        </span>
      </div>
      {!province && <p className="mt-2 text-xs text-dream-faint">Enter your province to calculate tax.</p>}
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-dream-muted">{label}</dt>
      <dd className="font-medium text-dream-ink">{value}</dd>
    </div>
  );
}
