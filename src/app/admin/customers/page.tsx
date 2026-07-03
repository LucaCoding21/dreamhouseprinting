import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { CustomersClient } from "./CustomersClient";

export const metadata = { title: "Customers | Admin" };

export default async function AdminCustomersPage() {
  await requirePermission("customers.view");
  const supabase = requireSupabaseServiceClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email, phone, organization_id")
    .eq("role", "customer")
    .order("created_at", { ascending: false });

  const customers = profiles ?? [];
  const customerIds = customers.map((c) => c.id);
  const orgIds = [...new Set(customers.map((c) => c.organization_id).filter(Boolean))] as string[];

  // Pull every order for these customers, then aggregate count + spend in JS.
  const [{ data: orders }, { data: orgs }] = await Promise.all([
    customerIds.length
      ? supabase.from("orders").select("customer_id, pricing").in("customer_id", customerIds)
      : Promise.resolve({ data: [] as { customer_id: string | null; pricing: unknown }[] }),
    orgIds.length
      ? supabase.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const stats = new Map<string, { orders: number; spent: number }>();
  for (const o of orders ?? []) {
    if (!o.customer_id) continue;
    const pricing = (o.pricing ?? {}) as unknown as { total?: number };
    const cur = stats.get(o.customer_id) ?? { orders: 0, spent: 0 };
    cur.orders += 1;
    cur.spent += pricing.total ?? 0;
    stats.set(o.customer_id, cur);
  }

  const orgNameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const rows = customers.map((c) => {
    const s = stats.get(c.id) ?? { orders: 0, spent: 0 };
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      org: c.organization_id ? orgNameById.get(c.organization_id) ?? null : null,
      orderCount: s.orders,
      totalSpent: s.spent,
    };
  });

  return <CustomersClient rows={rows} />;
}
