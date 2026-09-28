"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatCAD, roundCents } from "@/lib/money";
import {
  breakdownUnitPrice,
  chargeTotals,
  newCharge,
  type ChargePer,
  type PriceChargeDraft,
} from "@/lib/orders/priceBreakdown";

/**
 * Build a custom line's price out of labelled charges (blank, each print,
 * screens, ...). Each charge is per piece or one-time; the result fills the
 * line's unit price (see lib/orders/priceBreakdown.ts for the rounding rule).
 * Shared by the new-order form and the order detail card so the two match.
 */
export function PriceBreakdown({
  charges,
  qty,
  disabled = false,
  onChange,
}: {
  charges: PriceChargeDraft[];
  qty: number;
  disabled?: boolean;
  onChange: (next: PriceChargeDraft[]) => void;
}) {
  const patch = (id: string, fields: Partial<PriceChargeDraft>) =>
    onChange(charges.map((c) => (c.id === id ? { ...c, ...fields } : c)));

  const { each, once } = chargeTotals(charges);
  const unit = breakdownUnitPrice(charges, qty);
  const exact = roundCents(each * qty + once);
  const charged = roundCents(unit * qty);

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-dream-muted">Price breakdown</div>

      {charges.length > 0 && (
        <div className="space-y-2">
          {charges.map((c) => {
            const amt = Number(c.amount) || 0;
            const lineAmt = c.per === "once" ? amt : amt * qty;
            // Stacked to fit the narrow price rail: name on top, then
            // amount / each-or-once / remove underneath.
            return (
              <div key={c.id} className="space-y-1.5 rounded-lg border border-dream-line p-2">
                <div className="flex items-center gap-1">
                  <Input
                    value={c.label}
                    disabled={disabled}
                    placeholder="Blank, print, screens..."
                    aria-label="Charge name"
                    onChange={(e) => patch(c.id, { label: e.target.value })}
                    className="h-8 min-w-0 flex-1 px-2"
                  />
                  {!disabled && (
                    <button
                      type="button"
                      aria-label={`Remove ${c.label || "charge"}`}
                      onClick={() => onChange(charges.filter((x) => x.id !== c.id))}
                      className="shrink-0 rounded p-1 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-dream-muted">$</span>
                  <Input
                    value={c.amount}
                    disabled={disabled}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label="Amount"
                    onChange={(e) => patch(c.id, { amount: e.target.value })}
                    className="h-8 w-20 px-2"
                  />
                  <Select
                    value={c.per}
                    disabled={disabled}
                    aria-label="Charged per piece or once"
                    onChange={(e) => patch(c.id, { per: e.target.value as ChargePer })}
                    className="h-8 py-0 pl-2 pr-7"
                  >
                    <option value="each">each</option>
                    <option value="once">one-time</option>
                  </Select>
                </div>
                <div className="text-right text-xs tabular-nums text-dream-muted">{formatCAD(lineAmt)} for the line</div>
              </div>
            );
          })}
        </div>
      )}

      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...charges, newCharge()])}
          className="text-sm text-dream-purple hover:underline"
        >
          + Add a charge
        </button>
      )}

      {/* The resulting unit price is the (locked) Unit price box above this
          in the rail, so only the one-time spreading needs explaining here. */}
      {once > 0 && (
        <p className="text-xs text-dream-muted">
          {qty > 0
            ? `One-time charges are spread over ${qty} pieces.`
            : "One-time charges are added once pieces are entered."}
          {qty > 0 && charged !== exact && ` Rounds to ${formatCAD(charged)} for the line (exact ${formatCAD(exact)}).`}
        </p>
      )}
    </div>
  );
}
