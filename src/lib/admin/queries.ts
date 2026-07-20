import "server-only";

import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { ProductRow, CategoryRow, DecorationMethodRow, PrintAreaRow, PricingProfileRow } from "@/lib/db/rows";

/** A pricing profile plus how many products currently use it. */
export interface PricingProfileWithUsage {
  profile: PricingProfileRow;
  productCount: number;
}

/** All decoration pricing profiles, with per-profile usage counts. */
export async function getPricingProfiles(): Promise<PricingProfileWithUsage[]> {
  const supabase = requireSupabaseServiceClient();
  const [{ data: profiles }, { data: products }] = await Promise.all([
    supabase.from("pricing_profiles").select("*").order("name"),
    supabase.from("products").select("pricing_rules"),
  ]);
  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    const id = (p.pricing_rules as { profileId?: string } | null)?.profileId;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return (profiles ?? []).map((profile) => ({
    profile: profile as PricingProfileRow,
    productCount: counts.get((profile as PricingProfileRow).id) ?? 0,
  }));
}

/** All pricing profiles, unadorned (for the product editor's profile picker). */
export async function getPricingProfileRows(): Promise<PricingProfileRow[]> {
  const supabase = requireSupabaseServiceClient();
  const { data } = await supabase.from("pricing_profiles").select("*").order("name");
  return (data ?? []) as PricingProfileRow[];
}

/**
 * Admin read layer, uses the service client so staff see ALL products (incl.
 * inactive) and all config. Callers must already be permission-gated.
 */

export async function getAdminProducts(): Promise<ProductRow[]> {
  const supabase = requireSupabaseServiceClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as ProductRow[];
}

export async function getAdminProduct(id: string): Promise<{
  product: ProductRow;
  printAreas: PrintAreaRow[];
} | null> {
  const supabase = requireSupabaseServiceClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) return null;
  const { data: printAreas } = await supabase
    .from("print_areas")
    .select("*")
    .eq("product_id", id)
    .order("display_order");
  return { product: product as ProductRow, printAreas: (printAreas ?? []) as PrintAreaRow[] };
}

export async function getAllCategories(): Promise<CategoryRow[]> {
  const supabase = requireSupabaseServiceClient();
  const { data } = await supabase.from("categories").select("*").order("display_order");
  return (data ?? []) as CategoryRow[];
}

export async function getAllDecorationMethods(): Promise<DecorationMethodRow[]> {
  const supabase = requireSupabaseServiceClient();
  const { data } = await supabase
    .from("decoration_methods")
    .select("*")
    .order("display_order");
  return (data ?? []) as DecorationMethodRow[];
}
