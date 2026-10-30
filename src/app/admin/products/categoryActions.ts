"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Category management for Admin > Products > Categories.
 *
 * Two shapes only: a main category (is_major, no parent) or a sub-category
 * under a main one. The slug is minted once from the name and never changes on
 * rename, so shop links Julian has already shared keep working.
 */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function revalidateCategories() {
  // "layout" covers the product editor pages under /admin/products too.
  revalidatePath("/admin/products", "layout");
  revalidatePath("/shop", "layout");
}

/** Same-name check among siblings, case-insensitive. */
async function nameTaken(name: string, parentId: string | null, exceptId?: string): Promise<boolean> {
  const supabase = requireSupabaseServiceClient();
  let q = supabase.from("categories").select("id").ilike("name", name);
  q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
  const { data } = await q;
  return (data ?? []).some((r) => r.id !== exceptId);
}

export async function addCategoryAction(input: {
  name: string;
  parentId: string | null;
}): Promise<{ id?: string; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();
  const name = input.name.trim();
  if (!name) return { error: "Give the category a name." };

  let parentSlug: string | null = null;
  if (input.parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("slug, parent_id")
      .eq("id", input.parentId)
      .maybeSingle();
    if (!parent) return { error: "That main category no longer exists. Refresh and try again." };
    if (parent.parent_id) return { error: "Sub-categories can only sit under a main category." };
    parentSlug = parent.slug;
  }
  if (await nameTaken(name, input.parentId)) return { error: `There's already a category called ${name}.` };

  // Sub-categories follow the existing "shirts-long-sleeve" convention.
  const base = [parentSlug, slugify(name)].filter(Boolean).join("-") || "category";
  const { data: clashes } = await supabase.from("categories").select("slug").like("slug", `${base}%`);
  const used = new Set((clashes ?? []).map((r) => r.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;

  // New categories go to the end of their group.
  let last = supabase.from("categories").select("display_order").order("display_order", { ascending: false }).limit(1);
  last = input.parentId ? last.eq("parent_id", input.parentId) : last.is("parent_id", null);
  const { data: lastRow } = await last.maybeSingle();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name,
      slug,
      parent_id: input.parentId,
      is_major: !input.parentId,
      display_order: (lastRow?.display_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return { error: "Couldn't add the category. Try again." };

  revalidateCategories();
  return { id: data.id };
}

export async function renameCategoryAction(id: string, rawName: string): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();
  const name = rawName.trim();
  if (!name) return { error: "Give the category a name." };
  const { data: cat } = await supabase.from("categories").select("parent_id").eq("id", id).maybeSingle();
  if (!cat) return { error: "That category no longer exists. Refresh and try again." };
  if (await nameTaken(name, cat.parent_id, id)) return { error: `There's already a category called ${name}.` };

  // Name only: the slug (and so the shop link) stays as it was.
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) return { error: "Couldn't rename the category. Try again." };
  revalidateCategories();
  return { ok: true };
}

/** Products filed under the category, and sub-categories under it. */
export async function categoryUsageAction(
  id: string,
): Promise<{ products: string[]; productCount: number; subcategories: string[] }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();
  const [{ data: products, count }, { data: subs }] = await Promise.all([
    supabase
      .from("products")
      .select("name", { count: "exact" })
      .or(`category_id.eq.${id},subcategory_id.eq.${id}`)
      .order("name")
      .limit(5),
    supabase.from("categories").select("name").eq("parent_id", id).order("display_order"),
  ]);
  return {
    products: (products ?? []).map((p) => p.name),
    productCount: count ?? 0,
    subcategories: (subs ?? []).map((s) => s.name),
  };
}

export async function deleteCategoryAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();
  // Re-checked here, not just in the dialog: the FK is ON DELETE SET NULL, so a
  // delete with products still in it would silently uncategorize them.
  const usage = await categoryUsageAction(id);
  if (usage.productCount > 0) return { error: "Move its products to another category first." };
  if (usage.subcategories.length > 0) return { error: "Delete or move its sub-categories first." };

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: "Couldn't delete the category. Try again." };
  revalidateCategories();
  return { ok: true };
}

/** Rewrites display_order 1..n for one sibling group, in the order given. */
export async function reorderCategoriesAction(ids: string[]): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();
  if (ids.length === 0) return { ok: true };

  const { data: rows } = await supabase.from("categories").select("id, parent_id").in("id", ids);
  const parents = new Set((rows ?? []).map((r) => r.parent_id ?? "root"));
  if ((rows ?? []).length !== ids.length || parents.size !== 1) {
    return { error: "Categories can only be reordered within the same group." };
  }

  const results = await Promise.all(
    ids.map((id, i) => supabase.from("categories").update({ display_order: i + 1 }).eq("id", id)),
  );
  if (results.some((r) => r.error)) return { error: "Couldn't save the new order. Refresh and try again." };
  revalidateCategories();
  return { ok: true };
}
