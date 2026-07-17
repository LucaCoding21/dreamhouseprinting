import { requirePermission } from "@/lib/auth";
import { getPricingProfiles } from "@/lib/admin/queries";
import { PricingClient } from "./PricingClient";

export const metadata = { title: "Pricing | Admin" };

export default async function AdminPricingPage() {
  await requirePermission("products.manage");
  const profiles = await getPricingProfiles();
  return <PricingClient profiles={profiles} />;
}
