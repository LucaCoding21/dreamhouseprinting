/**
 * Admin-tunable decoration pricing + rush tiers. Stored in the `settings`
 * table under key "decoration_pricing" and edited from Admin, Settings,
 * Pricing. Pure module (no server imports) so the admin order editor, the
 * designer and the settings UI all share one formula.
 *
 * The DEFAULTS mirror the hardcoded quick-quote tables in lib/pricing.ts
 * (EXTRA_COLOUR_SURCHARGE / EXTRA_LOCATION_SURCHARGE), so until Julian edits
 * anything in settings, every surface prices exactly as before. Setup fees and
 * the embroidery size adder default to 0 because curve prices are
 * all-inclusive; raising them is Julian's call.
 */
import { roundCents } from "@/lib/money";

export interface QtyBreak {
  minQty: number;
  price: number;
}

/** A "just make it sooner" rush option: N business days for +pct% of the job. */
export interface RushTier {
  id: string;
  /** Production turnaround in business days. */
  days: number;
  /** Surcharge as a whole percent of the pre-tax job (subtotal + setup). */
  pct: number;
}

export interface DecorationPricingSettings {
  screen: {
    /** One-time fee per screen (per colour, per location). 0 = amortized into the curve. */
    setupPerScreen: number;
    /** Per-piece surcharge by TOTAL colour count of a print (1 colour adds nothing). */
    colourSurcharge: Record<number, number>;
    /** Per-piece surcharge for each print location beyond the first, by quantity. */
    extraLocationPerPiece: QtyBreak[];
  };
  embroidery: {
    /** One-time digitization fee per design. 0 = amortized into the curve. */
    digitizationFee: number;
    /** Per-piece surcharge for each embroidery location beyond the first, by quantity. */
    extraLocationPerPiece: QtyBreak[];
    /** Square inches included in the base price before the size adder kicks in. */
    includedSqIn: number;
    /** Per-piece charge for every square inch above includedSqIn. 0 = size not priced. */
    perExtraSqInPerPiece: number;
  };
  /** Standard production time shown next to the rush options. */
  standardDays: number;
  /** "I just want it sooner" options, fastest last. Empty = feature hidden. */
  rushTiers: RushTier[];
}

export const DECORATION_PRICING_SETTINGS_KEY = "decoration_pricing";

export const DEFAULT_DECORATION_PRICING: DecorationPricingSettings = {
  screen: {
    setupPerScreen: 0,
    colourSurcharge: { 1: 0, 2: 1.3, 3: 2.61, 4: 3.75, 5: 3.75, 6: 3.75, 7: 3.75, 8: 3.75 },
    extraLocationPerPiece: [
      { minQty: 10, price: 12.24 },
      { minQty: 25, price: 5.84 },
      { minQty: 50, price: 4.29 },
      { minQty: 100, price: 3.46 },
      { minQty: 250, price: 2.97 },
      { minQty: 500, price: 2.57 },
    ],
  },
  embroidery: {
    digitizationFee: 0,
    extraLocationPerPiece: [
      { minQty: 10, price: 15.81 },
      { minQty: 25, price: 10.98 },
      { minQty: 50, price: 9.25 },
      { minQty: 100, price: 8.23 },
      { minQty: 250, price: 7.62 },
      { minQty: 500, price: 6.77 },
    ],
    includedSqIn: 9,
    perExtraSqInPerPiece: 0,
  },
  standardDays: 12,
  rushTiers: [
    { id: "rush-8", days: 8, pct: 10 },
    { id: "rush-5", days: 5, pct: 15 },
    { id: "rush-3", days: 3, pct: 30 },
  ],
};

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function mergeBreaks(raw: unknown, fallback: QtyBreak[]): QtyBreak[] {
  if (!Array.isArray(raw)) return fallback;
  const rows = raw
    .map((r) => ({ minQty: num((r as QtyBreak)?.minQty, NaN), price: num((r as QtyBreak)?.price, NaN) }))
    .filter((r) => Number.isFinite(r.minQty) && r.minQty > 0 && Number.isFinite(r.price))
    .sort((a, b) => a.minQty - b.minQty);
  return rows.length > 0 ? rows : fallback;
}

function mergeColourMap(raw: unknown, fallback: Record<number, number>): Record<number, number> {
  if (!raw || typeof raw !== "object") return fallback;
  const out: Record<number, number> = { ...fallback };
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const count = Number(k);
    const n = num(v, NaN);
    if (Number.isInteger(count) && count >= 1 && count <= 8 && Number.isFinite(n)) out[count] = n;
  }
  return out;
}

function mergeRushTiers(raw: unknown, fallback: RushTier[]): RushTier[] {
  if (!Array.isArray(raw)) return fallback;
  return raw
    .map((r, i) => {
      const t = r as Partial<RushTier>;
      return {
        id: typeof t.id === "string" && t.id ? t.id : `rush-${i}`,
        days: Math.round(num(t.days, NaN)),
        pct: num(t.pct, NaN),
      };
    })
    .filter((t) => Number.isFinite(t.days) && t.days > 0 && Number.isFinite(t.pct) && t.pct > 0)
    .sort((a, b) => b.days - a.days);
}

/** Merge a stored settings blob over the defaults (defaults win for missing keys). */
export function mergeDecorationPricing(raw: unknown): DecorationPricingSettings {
  const v = (raw ?? {}) as Partial<DecorationPricingSettings>;
  const d = DEFAULT_DECORATION_PRICING;
  return {
    screen: {
      setupPerScreen: num(v.screen?.setupPerScreen, d.screen.setupPerScreen),
      colourSurcharge: mergeColourMap(v.screen?.colourSurcharge, d.screen.colourSurcharge),
      extraLocationPerPiece: mergeBreaks(v.screen?.extraLocationPerPiece, d.screen.extraLocationPerPiece),
    },
    embroidery: {
      digitizationFee: num(v.embroidery?.digitizationFee, d.embroidery.digitizationFee),
      extraLocationPerPiece: mergeBreaks(v.embroidery?.extraLocationPerPiece, d.embroidery.extraLocationPerPiece),
      includedSqIn: num(v.embroidery?.includedSqIn, d.embroidery.includedSqIn),
      perExtraSqInPerPiece: num(v.embroidery?.perExtraSqInPerPiece, d.embroidery.perExtraSqInPerPiece),
    },
    standardDays: Math.round(num(v.standardDays, d.standardDays)) || d.standardDays,
    rushTiers: mergeRushTiers(v.rushTiers, d.rushTiers),
  };
}

/* --------------------------------- formulas --------------------------------- */

export function priceAtQtyBreaks(breaks: QtyBreak[], qty: number): number {
  if (breaks.length === 0) return 0;
  let price = breaks[0].price;
  for (const b of breaks) {
    if (qty >= b.minQty) price = b.price;
    else break;
  }
  return price;
}

/** Per-piece surcharge for a screen print with this many colours (1 adds nothing). */
export function screenColourSurcharge(colours: number, s: DecorationPricingSettings): number {
  const clamped = Math.min(Math.max(Math.round(colours) || 1, 1), 8);
  return s.screen.colourSurcharge[clamped] ?? 0;
}

/** Per-piece surcharge for each location beyond the first, at this quantity. */
export function extraLocationSurcharge(
  decoration: "screen" | "embroidery",
  qty: number,
  s: DecorationPricingSettings,
): number {
  return priceAtQtyBreaks(s[decoration].extraLocationPerPiece, qty);
}

/** Per-piece embroidery size adder for a W×H inch design (0 with default settings). */
export function embroiderySizeSurcharge(widthIn: number, heightIn: number, s: DecorationPricingSettings): number {
  const sqIn = Math.max(0, widthIn) * Math.max(0, heightIn);
  const extra = Math.max(0, sqIn - s.embroidery.includedSqIn);
  return roundCents(extra * s.embroidery.perExtraSqInPerPiece);
}

/** Flat rush surcharge for a tier: pct% of (subtotal + setup), whole cents. */
export function rushTierFee(subtotal: number, setup: number, pct: number): number {
  return roundCents((subtotal + setup) * (pct / 100));
}
