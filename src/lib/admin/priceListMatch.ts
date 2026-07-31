/**
 * Picking a price list for a freshly imported S&S style, and checking a product
 * actually has a price.
 *
 * Imports used to land with no pricing at all, and anything unpriced fell
 * through to a cost-plus estimate that could quote well under cost. Rather than
 * handle "no price" everywhere downstream, a product is given a list the moment
 * it is created and cannot be made live without one, so the state stops
 * existing. Staff still change the list freely in the product editor.
 */
import type { PricingProfileRow } from "@/lib/db/rows";

/** Slug prefixes to try, in order, for text matching a rule. First hit wins. */
const RULES: { test: RegExp; slugs: string[] }[] = [
  { test: /\b(beanie|toque|knit cap)\b/i, slugs: ["beanie-embroidery", "cap-embroidery"] },
  { test: /\b(cap|hat|trucker|snapback|visor)\b/i, slugs: ["cap-embroidery", "beanie-embroidery"] },
  { test: /\b(hood|hoodie|hooded)\b/i, slugs: ["hoodie-standard"] },
  { test: /\b(crew ?neck|crewneck|sweatshirt|fleece)\b/i, slugs: ["crewneck-standard", "hoodie-standard"] },
  { test: /\b(tote|bag|backpack|drawstring|pouch)\b/i, slugs: ["tote-standard"] },
  { test: /\b(tee|t-shirt|shirt|tank|polo|long ?sleeve)\b/i, slugs: ["tee-standard"] },
];

/**
 * Best price list for a style, matched on its name plus S&S base category.
 *
 * Always returns a list when any exist: an unrecognised garment gets the first
 * one rather than nothing, because a rough price staff can correct beats an
 * unpriced product that silently misquotes. Returns null only when the shop has
 * no lists at all.
 */
export function pickProfileForStyle(
  profiles: PricingProfileRow[],
  text: string,
): PricingProfileRow | null {
  if (profiles.length === 0) return null;
  const bySlug = new Map(profiles.map((p) => [p.slug, p]));

  for (const rule of RULES) {
    if (!rule.test.test(text)) continue;
    for (const slug of rule.slugs) {
      const hit = bySlug.get(slug);
      if (hit) return hit;
    }
  }
  return bySlug.get("tee-standard") ?? profiles[0];
}

/** Does this product's pricing_rules carry a usable customer curve? */
export function hasQuoteCurve(pricingRules: unknown): boolean {
  const quote = (pricingRules as { quote?: { breaks?: Record<string, unknown> } } | null)?.quote;
  if (!quote?.breaks) return false;
  return Object.values(quote.breaks).some((v) => Array.isArray(v) && v.length > 0);
}
