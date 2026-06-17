import "server-only";

import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { ProductRow, CategoryRow, DecorationMethodRow, PrintAreaRow } from "@/lib/db/rows";

/**
 * Admin read layer — uses the service client so staff see ALL products (incl.
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
