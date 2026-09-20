import { requirePermission } from "@/lib/auth";
import { getPricingProfiles } from "@/lib/admin/queries";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { mergeAddonSettings } from "@/lib/addonSettings";
import {
  mergeDecorationPricing,
  DECORATION_PRICING_SETTINGS_KEY,
} from "@/lib/pricing/decorationPricing";
import type { SettingRow } from "@/lib/db/rows";
import { PricingClient } from "./PricingClient";

export const metadata = { title: "Pricing | Admin" };

export default async function AdminPricingPage() {
  const service = requireSupabaseServiceClient();
  const [, profiles, { data: settings }] = await Promise.all([
    requirePermission("products.manage"),
    getPricingProfiles(),
    service.from("settings").select("*").in("key", ["addons", DECORATION_PRICING_SETTINGS_KEY]),
  ]);

  const rows = (settings ?? []) as SettingRow[];
  return (
    <PricingClient
      profiles={profiles}
      decorationPricing={mergeDecorationPricing(
        rows.find((s) => s.key === DECORATION_PRICING_SETTINGS_KEY)?.value,
      )}
      addons={mergeAddonSettings(rows.find((s) => s.key === "addons")?.value)}
    />
  );
}
