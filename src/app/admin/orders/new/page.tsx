import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { loadAdminCatalog } from "@/lib/admin/catalog";
import {
  DECORATION_PRICING_SETTINGS_KEY,
  mergeDecorationPricing,
} from "@/lib/pricing/decorationPricing";
import { NewOrderClient } from "./NewOrderClient";

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
  const [, catalog, { data: pricingRow }] = await Promise.all([
    requirePermission("orders.edit"),
    loadAdminCatalog(service),
    // Julian's tunable colour / location / size surcharges, so the suggested
    // line price matches exactly what the storefront and order detail quote.
    service.from("settings").select("value").eq("key", DECORATION_PRICING_SETTINGS_KEY).maybeSingle(),
  ]);

  return (
    <NewOrderClient
      products={catalog.products}
      methodNames={catalog.methodNames}
      pricingSettings={mergeDecorationPricing(pricingRow?.value)}
    />
  );
}
