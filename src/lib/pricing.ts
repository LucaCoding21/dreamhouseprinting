import type { PrintMethod, ProductType } from "@/lib/formTypes";

// Placeholder pricing, single source of truth for both the homepage calculator
// and the /quote summary card. Replace with Julian's real numbers when ready.
export const BASE_PRICE: Record<ProductType, number> = {
  "t-shirts": 15,
  hoodies: 45,
  crewnecks: 38,
  hats: 22,
  "tote-bags": 16,
  other: 20,
};

export const PRINT_METHOD_SURCHARGE: Record<PrintMethod, number> = {
  screen: 0,
  embroidery: 5,
  dtg: 1,
  "not-sure": 0,
};

export const EXTRA_COLOR_PRICE = 1.5;

export function volumeDiscount(qty: number): number {
  if (qty >= 100) return 0.8;
  if (qty >= 50) return 0.88;
  if (qty >= 25) return 0.94;
  return 1;
}

// Customer-facing display rounding. Julian's rule: always round DOWN to the
// nearest tier-step so the quote is never higher than the calc. Tiers:
//   < $200   → floor to $1   (e.g. 93.74 → 93)
//   < $1000  → floor to $5   (e.g. 204.89 → 200)
//   ≥ $1000  → floor to $10  (e.g. 1009.34 → 1000)
export function roundDisplayPrice(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount < 200) return Math.floor(amount);
  if (amount < 1000) return Math.floor(amount / 5) * 5;
  return Math.floor(amount / 10) * 10;
}

export function calculatePrice(
  productType: ProductType | "",
  printMethod: PrintMethod,
  colors: number,
  qty: number,
): { perUnit: number; total: number } {
  if (!productType || qty <= 0) return { perUnit: 0, total: 0 };
  const base =
    BASE_PRICE[productType] +
    PRINT_METHOD_SURCHARGE[printMethod] +
    Math.max(0, colors - 1) * EXTRA_COLOR_PRICE;
  const perUnit = base * volumeDiscount(qty);
  return { perUnit, total: perUnit * qty };
}
