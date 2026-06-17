import { notFound } from "next/navigation";
import { requirePermission, getProfile, hasPermission } from "@/lib/auth";
import { getAdminOrder } from "@/lib/admin/orders";
import { OrderDetailClient } from "./OrderDetailClient";

export const metadata = { title: "Order — Admin" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("orders.view");
  const { id } = await params;
  const [detail, profile] = await Promise.all([getAdminOrder(id), getProfile()]);
  if (!detail) notFound();

  return (
    <OrderDetailClient
      detail={{
        order: detail.order,
        customer: detail.customer,
        lineItems: detail.lineItems,
        designs: detail.designs,
        proofs: detail.proofs,
        activity: detail.activity,
      }}
      can={{
        edit: hasPermission(profile, "orders.edit"),
        pricing: hasPermission(profile, "orders.pricing"),
        proofs: hasPermission(profile, "proofs.manage"),
      }}
    />
  );
}
