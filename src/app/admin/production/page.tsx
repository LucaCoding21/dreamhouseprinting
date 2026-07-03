import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { OrderRow, LineItemRow, ProfileRow, DecorationMethodRow } from "@/lib/db/rows";
import { ProductionBoard, type ProductionJob } from "./ProductionBoard";

export const metadata = { title: "Production | Admin" };

/** Statuses that represent active production work (PRD §7.5). */
const PRODUCTION_STATUSES = [
  "approved",
  "in_production",
  "quality_check",
  "ready_for_pickup",
  "shipped",
] as const;

function sumPieces(items: LineItemRow[]): number {
  let n = 0;
  for (const li of items) {
    const sq = (li.size_quantities ?? {}) as unknown as Record<string, number>;
    for (const v of Object.values(sq)) n += v || 0;
  }
  return n;
}

export default async function AdminProductionPage() {
  await requirePermission("production.manage");
  const supabase = requireSupabaseServiceClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .in("status", PRODUCTION_STATUSES as unknown as string[])
    .order("due_date", { ascending: true, nullsFirst: false });

  const orderRows = (orders ?? []) as OrderRow[];

  // Decoration method names — passed as a {id: name} map so the client can label cards.
  const { data: methods } = await supabase.from("decoration_methods").select("id, name");
  const methodNames: Record<string, string> = {};
  for (const m of (methods ?? []) as Pick<DecorationMethodRow, "id" | "name">[]) {
    methodNames[m.id] = m.name;
  }

  if (orderRows.length === 0) {
    return <ProductionBoard jobs={[]} methodNames={methodNames} />;
  }

  const orderIds = orderRows.map((o) => o.id);
  const customerIds = [...new Set(orderRows.map((o) => o.customer_id).filter(Boolean))] as string[];

  const [{ data: lineItems }, { data: profiles }] = await Promise.all([
    supabase.from("line_items").select("*").in("order_id", orderIds),
    customerIds.length
      ? supabase.from("profiles").select("id, name, email").in("id", customerIds)
      : Promise.resolve({ data: [] as Pick<ProfileRow, "id" | "name" | "email">[] }),
  ]);

  const liByOrder = new Map<string, LineItemRow[]>();
  for (const li of (lineItems ?? []) as LineItemRow[]) {
    const arr = liByOrder.get(li.order_id) ?? [];
    arr.push(li);
    liByOrder.set(li.order_id, arr);
  }

  const profileById = new Map(
    ((profiles ?? []) as Pick<ProfileRow, "id" | "name" | "email">[]).map((p) => [p.id, p])
  );

  const jobs: ProductionJob[] = orderRows.map((order) => {
    const items = liByOrder.get(order.id) ?? [];
    const profile = order.customer_id ? profileById.get(order.customer_id) : undefined;
    const methodIds = [
      ...new Set(items.map((li) => li.decoration_method_id).filter(Boolean) as string[]),
    ];
    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      dueDate: order.due_date,
      customerName: profile?.name ?? profile?.email ?? null,
      pieces: sumPieces(items),
      methodIds,
    };
  });

  return <ProductionBoard jobs={jobs} methodNames={methodNames} />;
}
