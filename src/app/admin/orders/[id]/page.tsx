import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth";
import { getAdminOrder } from "@/lib/admin/orders";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import {
  DECORATION_PRICING_SETTINGS_KEY,
  mergeDecorationPricing,
} from "@/lib/pricing/decorationPricing";
import type { DecorationMethodRow } from "@/lib/db/rows";
import { OrderDetailClient } from "./OrderDetailClient";

export const metadata = { title: "Order | Admin" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Permission gate, order detail and method names race in parallel; the gate
  // redirects before render. requirePermission returns the profile (deduped).
  const supabase = requireSupabaseServiceClient();
  const [profile, detail, { data: methods }, { data: pricingRow }] = await Promise.all([
    requirePermission("orders.view"),
    getAdminOrder(id),
    supabase.from("decoration_methods").select("id, name"),
    // Julian's tunable colour / location / size surcharges, so the order editor
    // reprices lines with exactly the numbers the storefront quotes with.
    supabase.from("settings").select("value").eq("key", DECORATION_PRICING_SETTINGS_KEY).maybeSingle(),
  ]);
  if (!detail) notFound();
  const methodNames: Record<string, string> = {};
  for (const m of (methods ?? []) as Pick<DecorationMethodRow, "id" | "name">[]) {
    methodNames[m.id] = m.name;
  }

  return (
    <OrderDetailClient
      detail={{
        order: detail.order,
        customer: detail.customer,
        lineItems: detail.lineItems,
        designs: detail.designs,
        products: detail.products,
        proofs: detail.proofs,
        activity: detail.activity,
        decorationPricing: mergeDecorationPricing(pricingRow?.value),
      }}
      methodNames={methodNames}
      can={{
        edit: hasPermission(profile, "orders.edit"),
        pricing: hasPermission(profile, "orders.pricing"),
        proofs: hasPermission(profile, "proofs.manage"),
      }}
    />
  );
}
