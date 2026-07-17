import { roundCents } from "@/lib/money";
import { garmentRetailUnit, type PricingInput } from "@/lib/pricing/platform";
import type {
  PricingProfileRow,
  ProductQuoteCurveJson,
  QuoteDecoration,
  PricingProfileSetupJson,
  PricingProfileTiersJson,
} from "@/lib/db/rows";

/**
 * Shared decoration pricing profiles: the component model that replaces the
 * per-product 48-cell table.
 *
 *   product tier(qty) = profile.tiers[deco](qty) + blankShift(product, profile)
 *
 * `profile.tiers` are Julian's validated all-inclusive prices for ONE reference
 * blank (`ref_wholesale`). `blankShift` is the retail difference between this
 * product's blank and that reference, at the product's own markup, so a product
 * that shares the reference blank reproduces the validated curve exactly, and a
 * pricier/cheaper blank shifts every tier by the real gap (the arithmetic Julian
 * used to do by hand across 48 cells). The result is written to
 * `products.pricing_rules.quote`, so every storefront/designer/order surface
 * keeps reading exactly what it does today.
 */

/** Floor for a compiled tier, so a very cheap blank can't shift a price to $0. */
export const MIN_TIER_PRICE = 0.5;

export interface PricingProfile {
  id: string;
  name: string;
  slug: string;
  decorations: QuoteDecoration[];
  /** Blank wholesale the `tiers` were calibrated against. */
  refWholesale: number | null;
  /** One-time setup fee per decoration (informational; already in `tiers`). */
  setup: PricingProfileSetupJson;
  /** Validated all-inclusive $/unit tiers at `refWholesale`. */
  tiers: PricingProfileTiersJson;
  isActive: boolean;
}

export function normalizeProfile(row: PricingProfileRow): PricingProfile {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    decorations: (row.decorations ?? []) as QuoteDecoration[],
    refWholesale: row.ref_wholesale,
    setup: (row.setup ?? {}) as PricingProfileSetupJson,
    tiers: (row.tiers ?? {}) as PricingProfileTiersJson,
    isActive: row.is_active,
  };
}

type BlankInput = Pick<
  PricingInput["product"],
  "wholesale_cost" | "base_price" | "markup_type" | "markup_value" | "pricing_rules"
>;

/**
 * Per-unit dollars to add to the profile's reference tiers for THIS product: the
 * retail gap between its blank and the profile's reference blank, at the product's
 * markup. Always computed off wholesale (base_price override ignored) so the shift
 * reflects the blank cost, not a manual retail override. Zero when the product IS
 * the reference blank.
 */
export function blankShift(
  product: BlankInput,
  profile: Pick<PricingProfile, "refWholesale">
): number {
  if (profile.refWholesale == null) return 0;
  const mine = garmentRetailUnit({ ...product, base_price: null });
  const ref = garmentRetailUnit({ ...product, base_price: null, wholesale_cost: profile.refWholesale });
  return roundCents(mine - ref);
}

/**
 * Compile a product's customer price curve from a shared profile + its blank.
 * Output shape is exactly `products.pricing_rules.quote`.
 */
export function compileCurveFromProfile(
  product: BlankInput,
  profile: PricingProfile
): ProductQuoteCurveJson {
  const shift = blankShift(product, profile);
  const breaks: ProductQuoteCurveJson["breaks"] = {};
  for (const d of profile.decorations) {
    breaks[d] = (profile.tiers[d] ?? [])
      .map((t) => ({ minQty: t.minQty, price: roundCents(Math.max(MIN_TIER_PRICE, t.price + shift)) }))
      .sort((a, b) => a.minQty - b.minQty);
  }
  return { decorations: profile.decorations, breaks };
}

/** Read the profile id a product points at, if any (products.pricing_rules.profileId). */
export function profileIdForProduct(
  product: Pick<BlankInput, "pricing_rules">
): string | null {
  const rules = (product.pricing_rules ?? {}) as { profileId?: string };
  return rules.profileId ?? null;
}
