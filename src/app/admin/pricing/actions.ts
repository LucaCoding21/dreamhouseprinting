"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { recompileProductsForProfile } from "@/lib/admin/pricing";
import type { Json } from "@/lib/db/types";
import type { PricingProfileRow, QuoteDecoration } from "@/lib/db/rows";

export interface ProfileTierInput {
  minQty: number;
  price: number;
}
export interface ProfileInput {
  name: string;
  decorations: QuoteDecoration[];
  setup: Partial<Record<QuoteDecoration, number>>;
  tiers: Partial<Record<QuoteDecoration, ProfileTierInput[]>>;
}

/** Clean + sort tiers: whole positive min qty, price > 0, ascending, deduped. */
function normalizeTiers(
  decorations: QuoteDecoration[],
  tiers: ProfileInput["tiers"]
): Record<string, ProfileTierInput[]> {
  const out: Record<string, ProfileTierInput[]> = {};
  for (const d of decorations) {
    const seen = new Set<number>();
    out[d] = (tiers[d] ?? [])
      .map((t) => ({ minQty: Math.max(1, Math.round(Number(t.minQty) || 0)), price: Number(t.price) || 0 }))
      .filter((t) => t.price > 0)
      .sort((a, b) => a.minQty - b.minQty)
      .filter((t) => (seen.has(t.minQty) ? false : (seen.add(t.minQty), true)));
  }
  return out;
}

async function afterProfileWrite(row: PricingProfileRow): Promise<number> {
  const recompiled = await recompileProductsForProfile(row);
  revalidatePath("/admin/pricing");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return recompiled;
}

/** Update a profile's name / setup / tiers, then reflow every product using it. */
export async function updatePricingProfileAction(
  id: string,
  input: ProfileInput
): Promise<{ ok?: boolean; recompiled?: number; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();

  const decorations = input.decorations.filter((d): d is QuoteDecoration => d === "screen" || d === "embroidery");
  const setup: Record<string, number> = {};
  for (const d of decorations) {
    const v = Number(input.setup[d]);
    if (Number.isFinite(v) && v > 0) setup[d] = Math.round(v * 100) / 100;
  }
  const tiers = normalizeTiers(decorations, input.tiers);

  const { data, error } = await supabase
    .from("pricing_profiles")
    .update({
      name: input.name.trim() || "Untitled profile",
      decorations,
      setup: setup as unknown as Json,
      tiers: tiers as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { error: error.message };

  const recompiled = await afterProfileWrite(data as PricingProfileRow);
  return { ok: true, recompiled };
}

/** Duplicate a profile (start a new family from the closest match). */
export async function duplicatePricingProfileAction(
  id: string
): Promise<{ ok?: boolean; id?: string; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();

  const { data: src } = await supabase.from("pricing_profiles").select("*").eq("id", id).single();
  if (!src) return { error: "Profile not found" };
  const base = src as PricingProfileRow;

  const slug = `${base.slug}-copy-${Math.abs(hash(base.slug + base.name)) % 100000}`;
  const { data, error } = await supabase
    .from("pricing_profiles")
    .insert({
      name: `${base.name} (copy)`,
      slug,
      decorations: base.decorations,
      ref_wholesale: base.ref_wholesale,
      setup: base.setup as Json,
      tiers: base.tiers as Json,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/admin/pricing");
  return { ok: true, id: data.id };
}

/** Delete a profile, only when no product references it. */
export async function deletePricingProfileAction(
  id: string
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();

  const { data: products } = await supabase
    .from("products")
    .select("id")
    .filter("pricing_rules->>profileId", "eq", id);
  if ((products ?? []).length > 0) {
    return { error: `${products!.length} product(s) still use this profile. Move them to another profile first.` };
  }

  const { error } = await supabase.from("pricing_profiles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/pricing");
  return { ok: true };
}

/** Stable non-crypto hash for slug disambiguation (Date/Math.random unavailable-safe). */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
