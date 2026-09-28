/**
 * Per-line price breakdown for custom lines: labelled charges the admin
 * builds the price from ("Blank $18 each", "Screens $60 one-time"), instead
 * of working the unit price out in his head.
 *
 * The breakdown only FEEDS the unit price. Every downstream total (line_total,
 * order pricing, tax, Stripe) still runs on unit_price x qty, so one-time
 * charges are spread across the pieces and rounded to the cent. That can leave
 * the line total a few cents off the exact sum, which the UI shows honestly.
 *
 * Stored on line_items.decorations.priceCharges (no migration). It is
 * admin-only by UI; the customer order view never reads it.
 */

export type ChargePer = "each" | "once";

/** UI shape: amount stays a string so a half-typed "4." survives. */
export interface PriceChargeDraft {
  id: string;
  label: string;
  amount: string;
  per: ChargePer;
}

/** Stored shape. */
export interface PriceCharge {
  id: string;
  label: string;
  amount: number;
  per: ChargePer;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function amountOf(v: string | number): number {
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Exact sums, before spreading one-time charges. */
export function chargeTotals(charges: { amount: string | number; per: ChargePer }[]) {
  let each = 0;
  let once = 0;
  for (const c of charges) {
    if (c.per === "once") once += amountOf(c.amount);
    else each += amountOf(c.amount);
  }
  return { each, once };
}

/**
 * The unit price the breakdown produces at this quantity. With no pieces yet,
 * one-time charges can't be spread, so only the per-piece charges count.
 */
export function breakdownUnitPrice(charges: { amount: string | number; per: ChargePer }[], qty: number): number {
  const { each, once } = chargeTotals(charges);
  return round2(each + (qty > 0 ? once / qty : 0));
}

let seq = 0;
export function newCharge(per: ChargePer = "each"): PriceChargeDraft {
  seq += 1;
  return { id: `c${Date.now().toString(36)}${seq}`, label: "", amount: "", per };
}

export function toDrafts(raw: unknown): PriceChargeDraft[] {
  return normalizeCharges(raw).map((c) => ({ ...c, amount: String(c.amount) }));
}

/** Server-side clean: drop junk, clamp strings, keep only real amounts or labels. */
export function normalizeCharges(raw: unknown): PriceCharge[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 30)
    .map((c, i) => {
      const r = (c ?? {}) as Record<string, unknown>;
      return {
        id: typeof r.id === "string" && r.id ? r.id.slice(0, 40) : `c${i}`,
        label: typeof r.label === "string" ? r.label.trim().slice(0, 80) : "",
        amount: round2(amountOf(r.amount as string | number)),
        per: r.per === "once" ? ("once" as const) : ("each" as const),
      };
    })
    .filter((c) => c.label || c.amount > 0);
}
