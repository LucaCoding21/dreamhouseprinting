/**
 * Canadian sales tax. Every province charges the 5% federal GST; the provincial
 * component is either a separate PST/QST or folded into a single HST. Rates are
 * current as of 2025 (Nova Scotia dropped HST 15% -> 14% on 2025-04-01).
 *
 * Tax is charged on the taxable base (goods + setup + shipping). We return a
 * breakdown of named lines so the checkout summary can show "GST" / "PST" /
 * "HST" exactly like the receipt the customer will get. Pure module — safe to
 * import on the client for the live order summary.
 *
 * If these ever need to vary per shop, lift the RATES table into `settings`.
 */
import { roundCents } from "@/lib/money";

export type ProvinceCode =
  | "AB" | "BC" | "MB" | "NB" | "NL" | "NS"
  | "NT" | "NU" | "ON" | "PE" | "QC" | "SK" | "YT";

export const PROVINCES: { code: ProvinceCode; name: string }[] = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

type RateLine = { label: string; rate: number };

const RATES: Record<ProvinceCode, RateLine[]> = {
  AB: [{ label: "GST", rate: 0.05 }],
  BC: [{ label: "GST", rate: 0.05 }, { label: "PST", rate: 0.07 }],
  MB: [{ label: "GST", rate: 0.05 }, { label: "PST", rate: 0.07 }],
  NB: [{ label: "HST", rate: 0.15 }],
  NL: [{ label: "HST", rate: 0.15 }],
  NS: [{ label: "HST", rate: 0.14 }],
  NT: [{ label: "GST", rate: 0.05 }],
  NU: [{ label: "GST", rate: 0.05 }],
  ON: [{ label: "HST", rate: 0.13 }],
  PE: [{ label: "HST", rate: 0.15 }],
  QC: [{ label: "GST", rate: 0.05 }, { label: "QST", rate: 0.09975 }],
  SK: [{ label: "GST", rate: 0.05 }, { label: "PST", rate: 0.06 }],
  YT: [{ label: "GST", rate: 0.05 }],
};

export interface TaxLine {
  label: string;
  rate: number;
  amount: number;
}
export interface TaxResult {
  lines: TaxLine[];
  total: number;
}

export function isProvinceCode(v: string | null | undefined): v is ProvinceCode {
  return !!v && v in RATES;
}

export function provinceName(code: ProvinceCode): string {
  return PROVINCES.find((p) => p.code === code)?.name ?? code;
}

/** Tax breakdown for a taxable base. Empty lines when the province is unknown. */
export function calcTax(taxableBase: number, province: ProvinceCode | null): TaxResult {
  if (!province || taxableBase <= 0) return { lines: [], total: 0 };
  const lines = RATES[province].map((l) => ({
    label: l.label,
    rate: l.rate,
    amount: roundCents(taxableBase * l.rate),
  }));
  return { lines, total: roundCents(lines.reduce((s, l) => s + l.amount, 0)) };
}
