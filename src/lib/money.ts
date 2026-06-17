/** Money helpers. Prices are CAD. */

export function formatCAD(amount: number | null | undefined): string {
  const n = typeof amount === "number" && isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Round to whole cents (half up) to avoid floating-point drift in totals. */
export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Round a per-unit display price UP to the nearest dollar (shop convention). */
export function roundDisplayUp(n: number): number {
  return Math.ceil(n - 1e-9);
}
