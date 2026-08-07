import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfile, isStaff } from "@/lib/auth";
import type { CategoryRow, ProductRow, DecorationMethodRow } from "./rows";

/**
 * Catalog read layer for the storefront + designer. Reads through the anon/auth
 * server client, so RLS guarantees only ACTIVE products/categories surface to
 * the public, deactivating in Admin hides everything with no code change (§10.4).
 */

export interface ProductFilter {
  categorySlug?: string;
  search?: string;
  /** Substring matched against the stored S&S brand name (e.g. "Gildan"). */
  brand?: string;
  decorationMethodId?: string;
  sort?: "newest" | "name" | "featured";
  limit?: number;
}

const LIST_COLUMNS =
  "id, name, brand, photos, colours, sizes, base_price, markup_type, markup_value, " +
  "wholesale_cost, pricing_rules, lead_time_days, stock_status, is_featured, category_id, subcategory_id, allowed_decoration_method_ids";

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("display_order", { ascending: true });
  return data ?? [];
}

/** Major categories (tiles + sidebar headers), in display order. */
export async function getMajorCategories(): Promise<CategoryRow[]> {
  const cats = await getCategories();
  return cats.filter((c) => c.is_major && !c.parent_id);
}

export async function getActiveProducts(filter: ProductFilter = {}): Promise<ProductRow[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("products").select(LIST_COLUMNS).eq("is_active", true);

  if (filter.categorySlug) {
    const cat = await getCategoryBySlug(filter.categorySlug);
    if (cat) {
      // Match the category itself OR any of its child subcategories.
      const cats = await getCategories();
      const childIds = cats.filter((c) => c.parent_id === cat.id).map((c) => c.id);
      const ids = [cat.id, ...childIds];
      q = q.or(ids.map((id) => `category_id.eq.${id},subcategory_id.eq.${id}`).join(","));
    }
  }
  if (filter.search) {
    // "shirts" / "toques" / "hats" should find the CATEGORY, not just product
    // names, so the nav search behaves the way people type. Tokenize both
    // sides, strip a trailing s (plural tolerance), and prefix-match; matching
    // category ids join the name ilike in one OR. Commas/parens are stripped
    // because they would break PostgREST or() syntax.
    const term = filter.search.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    if (term) {
      const stem = (s: string) => s.toLowerCase().replace(/s$/, "");
      const qTokens = term.split(/[^a-z0-9]+/i).filter(Boolean).map(stem);
      const cats = await getCategories();
      const catIds = cats
        .filter((c) => {
          const cTokens = c.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem);
          return qTokens.some((qt) => cTokens.some((ct) => ct === qt || ct.startsWith(qt)));
        })
        .map((c) => c.id);
      const ors = [`name.ilike.%${term}%`];
      for (const id of catIds) ors.push(`category_id.eq.${id}`, `subcategory_id.eq.${id}`);
      q = q.or(ors.join(","));
    }
  }
  if (filter.brand) q = q.ilike("brand", `%${filter.brand}%`);
  if (filter.decorationMethodId) q = q.contains("allowed_decoration_method_ids", [filter.decorationMethodId]);

  if (filter.sort === "name") q = q.order("name", { ascending: true });
  else if (filter.sort === "featured") q = q.order("is_featured", { ascending: false }).order("name");
  else q = q.order("created_at", { ascending: false });

  if (filter.limit) q = q.limit(filter.limit);

  const { data } = await q;
  return (data ?? []) as unknown as ProductRow[];
}

/** One featured pick per major category (the "Top 5" favourites row, §3.3.1). */
export async function getFeaturedByCategory(): Promise<{ category: CategoryRow; product: ProductRow }[]> {
  const supabase = await createSupabaseServerClient();
  const majors = await getMajorCategories();
  const out: { category: CategoryRow; product: ProductRow }[] = [];
  for (const cat of majors) {
    const { data } = await supabase
      .from("products")
      .select(LIST_COLUMNS)
      .eq("is_active", true)
      .or(`category_id.eq.${cat.id},subcategory_id.eq.${cat.id}`)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data[0]) out.push({ category: cat, product: data[0] as unknown as ProductRow });
  }
  return out;
}

export async function getCategoryBySlug(slug: string): Promise<CategoryRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("categories").select("*").eq("slug", slug).maybeSingle();
  return data ?? null;
}

export async function getProductById(id: string): Promise<ProductRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function getActiveDecorationMethods(): Promise<DecorationMethodRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("decoration_methods")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  return data ?? [];
}

/** Product + its print areas + the decoration methods it allows, everything the designer needs. */
export async function getProductForDesign(id: string) {
  const supabase = await createSupabaseServerClient();
  const product = await getProductById(id);
  if (!product) return null;
  // Staff may open the designer on an inactive product, so the admin's
  // draft preview ("Preview in shop") can click through the whole flow.
  // RLS already scopes inactive rows (product + print areas) to staff.
  if (!product.is_active && !isStaff(await getProfile())) return null;

  const [{ data: printAreas }, methods] = await Promise.all([
    supabase.from("print_areas").select("*").eq("product_id", id).order("display_order"),
    getActiveDecorationMethods(),
  ]);

  const allowed = (product.allowed_decoration_method_ids ?? []) as string[];
  const allowedMethods = methods.filter((m) => allowed.includes(m.id));

  return { product, printAreas: printAreas ?? [], decorationMethods: allowedMethods };
}
