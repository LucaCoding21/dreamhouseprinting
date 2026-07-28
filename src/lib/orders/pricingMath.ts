/**
 * Order money helpers shared by the admin Pricing card and the server actions
 * that persist pricing. Pure module (no server-only imports) so the live total
 * the admin sees and the total written to `orders.pricing` are computed by the
 * same code.
 *
 * Two things live here:
 *
 * 1. Adjustments, a free-form list of named discounts and fees stored at
 *    `orders.pricing.adjustments`. A NEGATIVE amount is a discount, a POSITIVE
 *    amount is a fee. They sit alongside the older single `discount` fields
 *    (which stay supported, they are the only way to take a percentage off).
 *
 * 2. The tax province. Tax follows the shipping address; a pickup order or an
 *    address with no usable province falls back to BC, the shop's own province.
 */
import { roundCents } from "@/lib/money";
import { PROVINCES, calcTax, isProvinceCode, type ProvinceCode } from "@/lib/pricing/tax";

/* --------------------------------- adjustments -------------------------------- */

export interface PriceAdjustment {
  /** Stable row key, generated client-side when the row is added. */
  id: string;
  label: string;
  /** Dollars. Negative discounts the order, positive adds a fee. */
  amount: number;
}

/** Coerce whatever is in the pricing jsonb into a clean adjustment list. */
export function normalizeAdjustments(value: unknown): PriceAdjustment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, i) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<PriceAdjustment>;
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) return [];
    return [
      {
        id: typeof row.id === "string" && row.id ? row.id : `adj-${i}`,
        label: typeof row.label === "string" ? row.label : "",
        amount: roundCents(amount),
      },
    ];
  });
}

/** Drop blank rows (no label and no amount) before saving. */
export function cleanAdjustments(list: PriceAdjustment[]): PriceAdjustment[] {
  return list
    .map((a) => ({ id: a.id, label: a.label.trim(), amount: roundCents(Number(a.amount) || 0) }))
    .filter((a) => a.label !== "" || a.amount !== 0);
}

export function adjustmentsTotal(list: PriceAdjustment[]): number {
  return roundCents(list.reduce((sum, a) => sum + (Number(a.amount) || 0), 0));
}

/** Fallback label for a row the admin never named. */
export function adjustmentLabel(a: PriceAdjustment): string {
  return a.label.trim() || (a.amount < 0 ? "Discount" : "Fee");
}

/* ------------------------------- order totals ------------------------------- */

export interface OrderMoneyParts {
  subtotal: number;
  setupFees: number;
  rush: number;
  addons: number;
  /** Positive dollars taken off by the single percentage/amount discount. */
  discount: number;
  /** Signed sum of the adjustment rows. */
  adjustments: number;
  shipping: number;
  tax: number;
}

/** Everything the tax is charged on: goods, less the discount, plus adjustments and shipping. */
export function taxableBase(p: Omit<OrderMoneyParts, "tax"> & { tax?: number }): number {
  const goods = p.subtotal + p.setupFees + p.rush + p.addons;
  return Math.max(roundCents(goods - p.discount + p.adjustments + p.shipping), 0);
}

export function orderTotal(p: OrderMoneyParts): number {
  const goods = p.subtotal + p.setupFees + p.rush + p.addons;
  return roundCents(goods - p.discount + p.adjustments + p.shipping + p.tax);
}

/* --------------------------------- tax province ------------------------------- */

/** The shop's own province, used when an order has no usable shipping province. */
export const FALLBACK_TAX_PROVINCE: ProvinceCode = "BC";

const PROVINCE_BY_NAME = new Map(PROVINCES.map((p) => [p.name.replace(/[^a-z]/gi, "").toUpperCase(), p.code]));
// Common spellings the picker never produces but a typed address might.
const PROVINCE_ALIASES: Record<string, ProvinceCode> = {
  QUEBEC: "QC",
  NEWFOUNDLAND: "NL",
  NEWFOUNDLANDANDLABRADOR: "NL",
  PEI: "PE",
  PRINCEEDWARDISLAND: "PE",
  NORTHWESTTERRITORY: "NT",
  YUKONTERRITORY: "YT",
};

/** Match a 2-letter code or a full province name, case and punctuation insensitive. */
export function parseProvince(value: string | null | undefined): ProvinceCode | null {
  if (!value) return null;
  // Strip accents so "Québec" matches, then keep letters only ("B.C." -> "BC").
  const letters = value.normalize("NFD").replace(/[^a-z]/gi, "").toUpperCase();
  if (!letters) return null;
  if (letters.length === 2 && isProvinceCode(letters)) return letters;
  return PROVINCE_BY_NAME.get(letters) ?? PROVINCE_ALIASES[letters] ?? null;
}

export interface ResolvedTaxProvince {
  code: ProvinceCode;
  /** Where the province came from: the shipping address, the pickup rule, or the fallback. */
  source: "address" | "pickup" | "fallback";
}

/**
 * The province an order is taxed at. Pickup is supplied at the shop, so it is
 * always the shop's province; a ship-to address wins when it names a province
 * we recognise; anything else falls back rather than charging no tax at all.
 */
export function resolveTaxProvince(input: {
  prov?: string | null;
  fulfillmentMethod?: string | null;
}): ResolvedTaxProvince {
  if (input.fulfillmentMethod === "pickup") return { code: FALLBACK_TAX_PROVINCE, source: "pickup" };
  const parsed = parseProvince(input.prov);
  if (parsed) return { code: parsed, source: "address" };
  return { code: FALLBACK_TAX_PROVINCE, source: "fallback" };
}

const pct = (rate: number) => String(Number((rate * 100).toFixed(3)));

/** Human summary of the rate applied, e.g. "ON HST 13%" or "BC GST + PST 12%". */
export function taxRateLabel(code: ProvinceCode): string {
  const { lines } = calcTax(100, code);
  if (lines.length === 0) return code;
  const total = lines.reduce((s, l) => s + l.rate, 0);
  return `${code} ${lines.map((l) => l.label).join(" + ")} ${pct(total)}%`;
}
