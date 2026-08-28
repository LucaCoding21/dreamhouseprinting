import "server-only";

import { curveForProduct, allowedCurveDecorations } from "@/lib/pricing/quote";
import type { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { ProductColourJson, ProductSizeJson } from "@/lib/db/rows";
import type { CatalogProduct } from "@/app/admin/orders/new/shared";

type Service = ReturnType<typeof requireSupabaseServiceClient>;

export interface AdminCatalog {
  products: CatalogProduct[];
  /** Every active decoration method's label, for the manual-order spec rows. */
  methodNames: string[];
}

/**
 * The whole catalog shaped for admin order entry: every product (hidden ones
 * included, since Julian may sell something not yet live in the shop) with its
 * colours, sizes, price curve and allowed decoration methods.
 *
 * Lives here rather than in the manual-order page so the order detail screen can
 * offer the same picker when adding a line to an order the customer submitted.
 */
export async function loadAdminCatalog(service: Service): Promise<AdminCatalog> {
  const [{ data: productRows }, { data: methodRows }] = await Promise.all([
    service
      .from("products")
      .select("id, name, brand, ss_style_name, is_active, sizes, colours, pricing_rules, allowed_decoration_method_ids")
      .order("is_active", { ascending: false })
      .order("name"),
    service
      .from("decoration_methods")
      .select("id, name, slug, is_active")
      .eq("is_active", true)
      .order("display_order"),
  ]);

  const methods = methodRows ?? [];
  const methodById = new Map(methods.map((m) => [m.id, m]));

  const products: CatalogProduct[] = (productRows ?? []).map((p) => {
    const curve = curveForProduct({ pricing_rules: p.pricing_rules });
    // Admin-disabled colours stay out of the picker, same as the shop.
    const colours = ((p.colours ?? []) as unknown as ProductColourJson[]).filter((c) => c.enabled !== false);
    const allowedIds = (p.allowed_decoration_method_ids ?? []) as string[];
    const allowed = allowedIds
      .map((id) => methodById.get(id))
      .filter((m): m is NonNullable<typeof m> => !!m);
    // A product with nothing configured still needs a method list to pick from.
    const productMethods = (allowed.length ? allowed : methods).map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
    }));
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      ssStyleName: p.ss_style_name,
      isActive: p.is_active,
      sizes: ((p.sizes ?? []) as unknown as ProductSizeJson[]).map((s) => s.name).filter(Boolean),
      colours,
      curve,
      decorations: curve ? allowedCurveDecorations(curve, productMethods.map((m) => m.slug)) : [],
      methods: productMethods,
    };
  });

  return { products, methodNames: methods.map((m) => m.name) };
}

/** Just the products, for callers that already know their decoration methods. */
export async function loadCatalogProducts(service: Service): Promise<CatalogProduct[]> {
  const { products } = await loadAdminCatalog(service);
  return products;
}
