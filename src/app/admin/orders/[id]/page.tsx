import { notFound } from "next/navigation";
import { requirePermission, getProfile, hasPermission } from "@/lib/auth";
import { getAdminOrder } from "@/lib/admin/orders";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { DecorationMethodRow } from "@/lib/db/rows";
import { OrderDetailClient } from "./OrderDetailClient";

export const metadata = { title: "Order | Admin" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("orders.view");
  const { id } = await params;
  const [detail, profile] = await Promise.all([getAdminOrder(id), getProfile()]);
  if (!detail) notFound();

  // Decoration method names so the spec table can label "Screen Print" etc.
  const supabase = requireSupabaseServiceClient();
  const { data: methods } = await supabase.from("decoration_methods").select("id, name");
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
