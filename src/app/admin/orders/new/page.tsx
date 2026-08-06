import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { curveForProduct, allowedCurveDecorations } from "@/lib/pricing/quote";
import {
  DECORATION_PRICING_SETTINGS_KEY,
  mergeDecorationPricing,
} from "@/lib/pricing/decorationPricing";
import type { ProductColourJson, ProductSizeJson } from "@/lib/db/rows";
import { NewOrderClient } from "./NewOrderClient";
import type { CatalogProduct } from "./shared";

export const metadata = { title: "New order | Admin" };

/**
 * Manual order entry: the phone / DM / walk-in path that never touches the
 * storefront funnel. Catalog products (including hidden ones, since Julian may
 * sell something not yet live) plus freeform lines for off-catalog jobs.
 * Renders as a fill-in clone of the order detail screen so both feel the same.
 */
export default async function NewOrderPage() {
  const service = requireSupabaseServiceClient();

  // Permission gate races the catalog read; the gate redirects before render.
  const [, { data: productRows }, { data: methodRows }, { data: pricingRow }] = await Promise.all([
    requirePermission("orders.edit"),
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
    // Julian's tunable colour / location / size surcharges, so the suggested
    // line price matches exactly what the storefront and order detail quote.
    service.from("settings").select("value").eq("key", DECORATION_PRICING_SETTINGS_KEY).maybeSingle(),
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

  return (
    <NewOrderClient
      products={products}
      methodNames={methods.map((m) => m.name)}
      pricingSettings={mergeDecorationPricing(pricingRow?.value)}
    />
  );
}
