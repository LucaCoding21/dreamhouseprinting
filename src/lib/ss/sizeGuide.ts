import "server-only";

import { ssGetSpecs } from "./client";
import type { SizeGuide } from "./types";

/**
 * Build a render-ready size guide for a style from the S&S /specs/ endpoint.
 * Pivots the flat spec rows into sizes × measurement columns, ordered by
 * sizeOrder. "Tolerance" rows (the ± allowances) are dropped — they're noise in
 * a customer size chart. Returns null when the style has no specs (or S&S is
 * unconfigured / unreachable — callers degrade gracefully).
 */
export async function buildSizeGuide(styleId: string | number): Promise<SizeGuide | null> {
  let specs;
  try {
    specs = await ssGetSpecs(styleId);
  } catch {
    return null;
  }
  if (!specs?.length) return null;

  const keep = specs.filter((s) => s.value?.trim() && !/tolerance/i.test(s.specName));
  if (!keep.length) return null;

  // Columns in first-seen order; sizes deduped and sorted by sizeOrder (lexical).
  const columns: string[] = [];
  for (const s of keep) if (!columns.includes(s.specName)) columns.push(s.specName);

  const sizeMeta = new Map<string, { order: string; values: Record<string, string> }>();
  for (const s of keep) {
    const entry = sizeMeta.get(s.sizeName) ?? { order: s.sizeOrder, values: {} };
    entry.values[s.specName] = s.value.trim();
    sizeMeta.set(s.sizeName, entry);
  }

  const rows = [...sizeMeta.entries()]
    .sort((a, b) => a[1].order.localeCompare(b[1].order))
    .map(([size, m]) => ({ size, values: m.values }));

  return {
    styleName: specs[0].styleName ?? "",
    brandName: specs[0].brandName ?? "",
    columns,
    rows,
  };
}
