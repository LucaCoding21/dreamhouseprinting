import { requirePermission } from "@/lib/auth";
import { getPricingProfiles } from "@/lib/admin/queries";
import { PricingClient } from "./PricingClient";

export const metadata = { title: "Pricing | Admin" };

export default async function AdminPricingPage() {
  const [, profiles] = await Promise.all([
    requirePermission("products.manage"),
    getPricingProfiles(),
  ]);
  return <PricingClient profiles={profiles} />;
}
