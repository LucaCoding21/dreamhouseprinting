import type { ProductType } from "@/lib/formTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Pricing model — Julian's real quick-quote prices (2026-05-28)
//
// These are FINAL customer-facing prices, not costs. They're Coastal Reign's
// rates minus 10%, with markup already baked in — charge them directly, no
// additional multiplier. Source of truth: our_pricing.csv (base) and
// our_pricing_addons.csv (extras) in the repo root.
//
//   per-item = base price (product + decoration + quantity break)
//            + screen colour surcharge (screen print only)
//            + extra-location surcharge × (locations − 1)
//
// Each base price already includes ONE decoration in ONE location:
//   • apparel  → 1-colour screen print  OR  1-location embroidery
//   • headwear → 1-location embroidery (no screen print offered)
// Decoration is now a customer choice on apparel (we captured both curves);
// headwear is embroidery-only.
//
// Embroidery on apparel always equals that garment's screen-print price plus a
// fixed universal premium (~$47/unit at qty 1, shrinking to ~$4.4 at volume) —
// confirmed identical across all four apparel SKUs.
//
// Still NOT collected by the quick quote (in our_pricing_addons.csv for the
// full form later): per-name/number charges and the 2XL+ size surcharge.
// ─────────────────────────────────────────────────────────────────────────────

// SKUs we have real pricing for. The quick quote selects these directly; the
// full form's ProductType collapses both headwear SKUs into "hats" (see
// pricedFromProductType), so the form can't price hats on its own.
export type PricedProduct =
  | "t-shirts"
  | "hoodies"
  | "crewnecks"
  | "tote-bags"
  | "toque"
  | "dad-cap";

export type Decoration = "screen" | "embroidery";

// Decorations a product can actually be priced for (first entry is the default).
export const AVAILABLE_DECORATIONS: Record<PricedProduct, Decoration[]> = {
  "t-shirts": ["screen", "embroidery"],
  hoodies: ["screen", "embroidery"],
  crewnecks: ["screen", "embroidery"],
  "tote-bags": ["screen", "embroidery"],
  toque: ["embroidery"],
  "dad-cap": ["embroidery"],
};

// Default decoration per product (kept for the form mapping + back-compat).
export const DECORATION: Record<PricedProduct, Decoration> = {
  "t-shirts": "screen",
  hoodies: "screen",
  crewnecks: "screen",
  "tote-bags": "screen",
  toque: "embroidery",
  "dad-cap": "embroidery",
};

// price_per_unit_cad by quantity break. Each [minQty, price] applies from minQty
// up to the next break; a quantity between breaks uses the next-lowest one.
type Break = [minQty: number, price: number];

// Base per-unit price by product → decoration → quantity break. Each price
// already includes one decoration in one location.
const BASE_PRICE: Record<PricedProduct, Partial<Record<Decoration, Break[]>>> = {
  // ATC Everyday Cotton Tee (ATC1000)
  "t-shirts": {
    screen: [
      [1, 66.25], [2, 40.5], [3, 31.92], [5, 25.04], [10, 19.89], [12, 19.04],
      [15, 18.18], [20, 16.31], [25, 14.85], [30, 13.86], [40, 12.6], [50, 11.82],
      [72, 10.83], [75, 10.74], [100, 10.14], [144, 9.72], [150, 9.67], [200, 9.45],
      [250, 9.14], [300, 8.89], [350, 8.66], [500, 8.09], [750, 7.69], [1000, 7.65],
    ],
    embroidery: [
      [1, 108.74], [2, 61.37], [3, 45.57], [5, 32.94], [10, 23.47], [12, 21.88],
      [15, 20.31], [20, 18.72], [25, 17.77], [30, 17.1], [40, 16.23], [50, 15.68],
      [72, 14.94], [75, 14.86], [100, 14.37], [144, 14.09], [150, 14.06], [200, 13.91],
      [250, 13.58], [300, 13.27], [350, 12.99], [500, 12.19], [750, 12.19], [1000, 11.62],
    ],
  },
  // Gildan Heavy Blend Hoodie (GILDAN18500)
  hoodies: {
    screen: [
      [1, 81.87], [2, 56.11], [3, 47.52], [5, 40.66], [10, 35.51], [12, 34.65],
      [15, 33.79], [20, 31.93], [25, 30.46], [30, 29.43], [40, 28.08], [50, 27.23],
      [72, 26.06], [75, 25.93], [100, 25.13], [144, 24.71], [150, 24.67], [200, 24.44],
      [250, 23.86], [300, 23.33], [350, 22.84], [500, 21.42], [750, 20.48], [1000, 20.43],
    ],
    embroidery: [
      [1, 124.36], [2, 76.98], [3, 61.19], [5, 48.55], [10, 39.08], [12, 37.5],
      [15, 35.92], [20, 34.34], [25, 33.38], [30, 32.67], [40, 31.71], [50, 31.08],
      [72, 30.16], [75, 30.06], [100, 29.36], [144, 29.08], [150, 29.06], [200, 28.91],
      [250, 28.3], [300, 27.72], [350, 27.16], [500, 25.53], [750, 24.44], [1000, 24.41],
    ],
  },
  // Gildan Heavy Blend Crewneck (GILDAN18000)
  crewnecks: {
    screen: [
      [1, 75.17], [2, 49.41], [3, 40.84], [5, 33.97], [10, 28.81], [12, 27.96],
      [15, 27.09], [20, 25.23], [25, 23.77], [30, 22.76], [40, 21.44], [50, 20.62],
      [72, 19.53], [75, 19.42], [100, 18.71], [144, 18.28], [150, 18.24], [200, 18.0],
      [250, 17.55], [300, 17.14], [350, 16.76], [500, 15.7], [750, 15.0], [1000, 14.95],
    ],
    embroidery: [
      [1, 117.66], [2, 70.28], [3, 54.5], [5, 41.86], [10, 32.39], [12, 30.8],
      [15, 29.23], [20, 27.65], [25, 26.69], [30, 25.99], [40, 25.08], [50, 24.48],
      [72, 23.64], [75, 23.55], [100, 22.94], [144, 22.66], [150, 22.63], [200, 22.48],
      [250, 21.98], [300, 21.52], [350, 21.08], [500, 19.81], [750, 18.96], [1000, 18.93],
    ],
  },
  // Q-Tees Economical Tote (QTEES-TOTE)
  "tote-bags": {
    screen: [
      [1, 63.4], [2, 37.64], [3, 29.06], [5, 22.19], [10, 17.04], [12, 16.18],
      [15, 15.32], [20, 13.45], [25, 12.0], [30, 11.01], [40, 9.77], [50, 9.0],
      [72, 8.05], [75, 7.96], [100, 7.39], [144, 6.97], [150, 6.93], [200, 6.7],
      [250, 6.45], [300, 6.25], [350, 6.07], [500, 5.64], [750, 5.35], [1000, 5.31],
    ],
    embroidery: [
      [1, 105.89], [2, 58.51], [3, 42.72], [5, 30.08], [10, 20.61], [12, 19.03],
      [15, 17.46], [20, 15.87], [25, 14.92], [30, 14.25], [40, 13.4], [50, 12.87],
      [72, 12.15], [75, 12.08], [100, 11.63], [144, 11.34], [150, 11.33], [200, 11.17],
      [250, 10.89], [300, 10.63], [350, 10.4], [500, 9.75], [750, 9.31], [1000, 9.28],
    ],
  },
  // Solid 12in Cuffed Beanie (SP12) — embroidery only
  toque: {
    embroidery: [
      [1, 109.55], [2, 62.18], [3, 46.38], [5, 33.75], [10, 24.27], [12, 22.69],
      [15, 21.12], [20, 19.53], [25, 18.58], [30, 17.91], [40, 17.03], [50, 16.47],
      [72, 15.73], [75, 15.65], [100, 15.14], [144, 14.86], [150, 14.84], [200, 14.68],
      [250, 14.34], [300, 14.02], [350, 13.72], [500, 12.87], [750, 12.31], [1000, 12.28],
    ],
  },
  // Yupoong Classic Dad Cap (6245CM) — embroidery only
  "dad-cap": {
    embroidery: [
      [1, 116.55], [2, 69.17], [3, 53.37], [5, 40.74], [10, 31.26], [12, 29.69],
      [15, 28.1], [20, 26.53], [25, 25.56], [30, 24.87], [40, 23.96], [50, 23.38],
      [72, 22.54], [75, 22.46], [100, 21.86], [144, 21.58], [150, 21.56], [200, 21.41],
      [250, 20.93], [300, 20.49], [350, 20.07], [500, 18.85], [750, 18.04], [1000, 18.01],
    ],
  },
};

// Extra screen-print colours — TOTAL per-unit surcharge over the 1 colour the
// base price already includes (not stacked). Indexed by colour count; 4+ is a
// plateau. Embroidery is priced by location, not colour, so this never applies
// to headwear or to embroidered apparel. (Measured at qty ~50; CR waives the
// colour upcharge at very low quantities, so this slightly over-estimates there
// — acceptable for an estimate that rounds up.)
//
// TODO: this is a flat table (qty ~50). The real per-colour upcharge scales with
// quantity (≈$0 under ~12 units, ~$1.30 at 50, ~$0.68 at 250). It's left flat on
// purpose — see CLAUDE.md philosophy + it errs high, which protects margin.
// REVISIT (make quantity-aware) if large multi-colour orders start bouncing off
// the estimate; you'd want to capture more colour data points first.
const EXTRA_COLOUR_SURCHARGE: Record<number, number> = {
  1: 0,
  2: 1.3,
  3: 2.61,
  4: 3.75,
  5: 3.75,
};

// Per-unit surcharge for EACH print/embroidery location beyond the first (the
// base price already includes one). Adds linearly — a 3rd location costs the
// same as the 2nd. Drops with quantity as setup amortizes. Values are CR −10%.
const EXTRA_LOCATION_SURCHARGE: Record<Decoration, Break[]> = {
  screen: [
    [10, 12.24], [25, 5.84], [50, 4.29], [100, 3.46], [250, 2.97], [500, 2.57],
  ],
  embroidery: [
    [10, 15.81], [25, 10.98], [50, 9.25], [100, 8.23], [250, 7.62], [500, 6.77],
  ],
};

// Max number of decoration locations the quick quote prices.
export const MAX_LOCATIONS = 4;

function priceAtQty(breaks: Break[], qty: number): number {
  let price = breaks[0][1];
  for (const [min, p] of breaks) {
    if (qty >= min) price = p;
    else break;
  }
  return price;
}

export type PriceQuote =
  | { available: true; perUnit: number; total: number }
  | { available: false };

// The single pricing entry point.
//   • decoration defaults to the product's default (screen for apparel,
//     embroidery for headwear). Unavailable combos return { available:false }.
//   • colors is ignored for embroidery.
//   • locations defaults to 1; each extra adds the location surcharge.
export function calculateQuote(
  product: PricedProduct,
  qty: number,
  colors: number,
  decoration: Decoration = DECORATION[product],
  locations = 1,
): PriceQuote {
  if (qty <= 0) return { available: false };

  const breaks = BASE_PRICE[product][decoration];
  if (!breaks) return { available: false };

  const base = priceAtQty(breaks, qty);

  const colourSurcharge =
    decoration === "screen"
      ? EXTRA_COLOUR_SURCHARGE[Math.min(Math.max(colors, 1), 5)] ?? 0
      : 0;

  const extraLocations = Math.max(0, locations - 1);
  const locationSurcharge =
    extraLocations > 0
      ? extraLocations * priceAtQty(EXTRA_LOCATION_SURCHARGE[decoration], qty)
      : 0;

  const perUnit = base + colourSurcharge + locationSurcharge;
  return { available: true, perUnit, total: perUnit * qty };
}

// Screen-print surcharge for a single location's colour count — the TOTAL extra
// over the 1 colour a location already includes (0 for a 1-colour print). Used
// per-location so a 4-colour back is costed on its own screens, not the front's.
export function colourSurcharge(colors: number): number {
  return EXTRA_COLOUR_SURCHARGE[Math.min(Math.max(colors, 1), 5)] ?? 0;
}

// Per-location pricing entry point (Coastal-Reign style). Instead of one global
// colour count, callers pass the colour count for EACH print location. This
// prices multi-location jobs accurately: every location carries its own colour
// screens plus the per-extra-location fee, so "2 colours on 3 locations" costs
// more than "1 colour on 3 locations" (the old flat-per-location math missed
// this).
//
//   perUnit = base garment (incl. 1 location, 1 colour)
//           + Σ colourSurcharge(location colours)   [screen print only]
//           + (locations − 1) × extra-location fee
//
// The base already bakes in one 1-colour location; the extra-location fee stands
// in for adding a 1-colour print at a new spot, and colourSurcharge tops up each
// spot's additional colours. Embroidery is priced by location only — colours
// don't change the stitch cost, so coloursPerLocation is used only for its
// LENGTH (the number of locations).
export function calculateQuoteByLocation(
  product: PricedProduct,
  qty: number,
  decoration: Decoration,
  coloursPerLocation: number[],
): PriceQuote {
  if (qty <= 0) return { available: false };

  const breaks = BASE_PRICE[product][decoration];
  if (!breaks) return { available: false };

  const base = priceAtQty(breaks, qty);
  const locations = Math.max(1, coloursPerLocation.length);

  const colourSurchargeTotal =
    decoration === "screen"
      ? coloursPerLocation.reduce((sum, c) => sum + colourSurcharge(c), 0)
      : 0;

  const extraLocations = locations - 1;
  const locationSurcharge =
    extraLocations > 0
      ? extraLocations * priceAtQty(EXTRA_LOCATION_SURCHARGE[decoration], qty)
      : 0;

  const perUnit = base + colourSurchargeTotal + locationSurcharge;
  return { available: true, perUnit, total: perUnit * qty };
}

// Maps the form's coarser ProductType onto a priced SKU. Everything maps 1:1
// except "hats" (the form can't tell toque from dad-cap) and "other" (no data),
// which return null (no estimate).
export function pricedFromProductType(p: ProductType | ""): PricedProduct | null {
  if (p === "t-shirts" || p === "hoodies" || p === "crewnecks" || p === "tote-bags") {
    return p;
  }
  return null;
}

// Customer-facing display rounding: round DOWN to the nearest whole dollar so
// the shown per-item price is a clean, friendly number (e.g. $11.82 -> $11).
// This is presentation only; the quote is an estimate and Julian confirms the
// final price.
export function roundDisplayPrice(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount);
}
