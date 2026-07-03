import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCAD } from "@/lib/money";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderRow, LineItemRow, ProfileRow, OrderStatus } from "@/lib/db/rows";

export const metadata = { title: "Reports | Admin" };

interface PricingShape {
  subtotal?: number;
  setupFees?: number;
  shipping?: number;
  tax?: number;
  total?: number;
}

function sumQuantities(sizes: unknown): number {
  const sq = (sizes ?? {}) as Record<string, number>;
  let n = 0;
  for (const v of Object.values(sq)) n += Number(v) || 0;
  return n;
}

export default async function AdminReportsPage() {
  await requirePermission("reports.view");
  const supabase = requireSupabaseServiceClient();

  const [{ data: ordersData }, { data: lineItemsData }] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("line_items").select("*"),
  ]);

  const orders = (ordersData ?? []) as OrderRow[];
  const lineItems = (lineItemsData ?? []) as LineItemRow[];

  // Resolve customer emails for the outstanding-balances table.
  const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))] as string[];
  const profileById = new Map<string, Pick<ProfileRow, "id" | "name" | "email">>();
  if (customerIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", customerIds);
    for (const p of (profiles ?? []) as Pick<ProfileRow, "id" | "name" | "email">[]) {
      profileById.set(p.id, p);
    }
  }

  const active = orders.filter((o) => o.status !== "cancelled");

  const totalRevenue = active.reduce((sum, o) => {
    const pricing = (o.pricing ?? {}) as unknown as PricingShape;
    return sum + (pricing.total ?? 0);
  }, 0);

  const orderCount = active.length;

  // Outstanding: active orders not yet paid in full. No amount-paid field exists,
  // so the whole order total is treated as the balance owed.
  const outstanding = active
    .filter((o) => o.payment_status !== "paid_in_full")
    .map((o) => {
      const pricing = (o.pricing ?? {}) as unknown as PricingShape;
      const profile = o.customer_id ? profileById.get(o.customer_id) : undefined;
      return {
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        paymentStatus: o.payment_status,
        balance: pricing.total ?? 0,
        customerName: profile?.name ?? null,
        customerEmail: profile?.email ?? null,
      };
    })
    .filter((o) => o.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const outstandingTotal = outstanding.reduce((sum, o) => sum + o.balance, 0);

  // Best sellers — aggregate pieces + line count by product name.
  const byProduct = new Map<string, { name: string; pieces: number; lines: number }>();
  for (const li of lineItems) {
    const name = (li.product_name ?? "Unnamed product").trim() || "Unnamed product";
    const entry = byProduct.get(name) ?? { name, pieces: 0, lines: 0 };
    entry.pieces += sumQuantities(li.size_quantities);
    entry.lines += 1;
    byProduct.set(name, entry);
  }
  const bestSellers = [...byProduct.values()]
    .sort((a, b) => b.pieces - a.pieces || b.lines - a.lines)
    .slice(0, 5);

  const stats = [
    { label: "Total revenue", value: formatCAD(totalRevenue) },
    { label: "Orders", value: String(orderCount) },
    { label: "Outstanding balance", value: formatCAD(outstandingTotal) },
    { label: "Unpaid orders", value: String(outstanding.length) },
  ];

  return (
    <div>
      <AdminHeader title="Reports">
        <a
          href="/api/admin/reports/orders.csv"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-dream-purple px-4 text-sm font-display font-medium text-white shadow-sm transition-colors hover:bg-dream-purple-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
          download
        >
          Download CSV
        </a>
      </AdminHeader>

      <div className="px-8 py-6">
        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-dream-line bg-dream-surface p-4">
              <div className="font-display text-3xl font-bold text-dream-ink">{s.value}</div>
              <div className="text-sm text-dream-muted">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Best sellers */}
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-bold text-dream-ink">Best sellers</h2>
          {bestSellers.length === 0 ? (
            <EmptyState
              title="No sales yet"
              description="Best-selling products appear here once orders contain line items."
            />
          ) : (
            <div className="rounded-xl border border-dream-line bg-dream-surface">
              <Table>
                <THead>
                  <TR>
                    <TH>Product</TH>
                    <TH>Pieces sold</TH>
                    <TH>Line items</TH>
                  </TR>
                </THead>
                <TBody>
                  {bestSellers.map((p) => (
                    <TR key={p.name}>
                      <TD>
                        <span className="font-medium text-dream-ink">{p.name}</span>
                      </TD>
                      <TD>{p.pieces.toLocaleString("en-CA")} pcs</TD>
                      <TD>{p.lines.toLocaleString("en-CA")}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </section>

        {/* Outstanding balances */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-dream-ink">Outstanding balances</h2>
          {outstanding.length === 0 ? (
            <EmptyState
              title="Nothing owed"
              description="Every active order is paid in full. Nice."
            />
          ) : (
            <div className="rounded-xl border border-dream-line bg-dream-surface">
              <Table>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    <TH>Customer</TH>
                    <TH>Status</TH>
                    <TH>Payment</TH>
                    <TH>Balance</TH>
                  </TR>
                </THead>
                <TBody>
                  {outstanding.map((o) => {
                    const meta = STATUS_META[o.status as OrderStatus];
                    return (
                      <TR key={o.id}>
                        <TD>
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="font-medium text-dream-purple hover:underline"
                          >
                            {o.orderNumber ?? "—"}
                          </Link>
                        </TD>
                        <TD>
                          <div className="font-medium text-dream-ink">
                            {o.customerName ?? o.customerEmail ?? "—"}
                          </div>
                          {o.customerName && o.customerEmail ? (
                            <div className="text-xs text-dream-muted">{o.customerEmail}</div>
                          ) : null}
                        </TD>
                        <TD>
                          <Badge variant={meta?.badge ?? "neutral"}>{meta?.label ?? o.status}</Badge>
                        </TD>
                        <TD className="capitalize text-dream-muted">
                          {o.paymentStatus.replace(/_/g, " ")}
                        </TD>
                        <TD>
                          <span className="font-medium text-dream-ink">{formatCAD(o.balance)}</span>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
