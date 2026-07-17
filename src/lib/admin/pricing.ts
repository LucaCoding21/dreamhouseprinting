import "server-only";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { compileCurveFromProfile, normalizeProfile } from "@/lib/pricing/profile";
import type { PricingProfileRow, ProductRow } from "@/lib/db/rows";
import type { Json } from "@/lib/db/types";

/**
 * Recompile `pricing_rules.quote` for every product pointing at a profile, after
 * the profile's tiers change. Each product keeps its own blank shift, so editing
 * a profile once reflows the whole family. Returns the number recompiled.
 */
export async function recompileProductsForProfile(profileRow: PricingProfileRow): Promise<number> {
  const supabase = requireSupabaseServiceClient();
  const profile = normalizeProfile(profileRow);
  const { data: products } = await supabase
    .from("products")
    .select("id, wholesale_cost, base_price, markup_type, markup_value, pricing_rules")
    .filter("pricing_rules->>profileId", "eq", profile.id);

  let n = 0;
  for (const p of products ?? []) {
    const quote = compileCurveFromProfile(p as ProductRow, profile);
    const rules = { ...((p.pricing_rules ?? {}) as Record<string, unknown>), profileId: profile.id, quote };
    const { error } = await supabase.from("products").update({ pricing_rules: rules as unknown as Json }).eq("id", p.id);
    if (!error) n++;
  }
  return n;
}

/**
 * Build the `pricing_rules` value for a single product given a chosen profile
 * (or null to detach). With a profile it stamps `profileId` + the compiled
 * `quote`; without one it drops both so the product falls back to garment retail.
 */
export function buildProductPricingRules(
  product: Pick<ProductRow, "wholesale_cost" | "base_price" | "markup_type" | "markup_value" | "pricing_rules">,
  profileRow: PricingProfileRow | null
): Record<string, unknown> {
  const existing = (product.pricing_rules ?? {}) as Record<string, unknown>;
  const { profileId: _p, quote: _q, ...rest } = existing;
  void _p;
  void _q;
  if (!profileRow) return rest;
  const profile = normalizeProfile(profileRow);
  return { ...rest, profileId: profile.id, quote: compileCurveFromProfile(product, profile) };
}
