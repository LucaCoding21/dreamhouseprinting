import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { getAdminOrders } from "@/lib/admin/orders";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { formatCAD } from "@/lib/money";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus, OrderActivityRow } from "@/lib/db/rows";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Dashboard — Admin" };

const NEW_STATUSES = ["submitted", "in_review"];
const PROOF_STATUSES = ["proof_ready", "changes_requested"];
const PRODUCTION_STATUSES = ["approved", "in_production", "quality_check"];
const FULFILMENT_STATUSES = ["quality_check", "shipped"];
const CLOSED_STATUSES = ["completed", "cancelled"];

function daysOverdue(due: string): number {
  return Math.ceil((Date.now() - new Date(due).getTime()) / 86400000);
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const profile = await requireStaff();
  const { denied } = await searchParams;

  const orders = await getAdminOrders();

  // --- Operational counts (PRD §7.2) ---
  const has = (statuses: string[], status: string) => statuses.includes(status);
  const newOrders = orders.filter((o) => has(NEW_STATUSES, o.order.status)).length;
  const awaitingProof = orders.filter((o) => has(PROOF_STATUSES, o.order.status)).length;
  const inProduction = orders.filter((o) => has(PRODUCTION_STATUSES, o.order.status)).length;
  const readyToShip = orders.filter((o) => has(FULFILMENT_STATUSES, o.order.status)).length;

  // Outstanding balance: orders not paid in full and not cancelled.
  const outstanding = orders
    .filter((o) => o.order.payment_status !== "paid_in_full" && o.order.status !== "cancelled")
    .reduce((sum, o) => {
      const total = (o.order.pricing ?? {}) as { total?: number };
      return sum + (total.total ?? 0);
    }, 0);

  const stats = [
    { label: "New orders", value: newOrders, tab: "new" },
    { label: "Awaiting approval", value: awaitingProof, tab: "proofing" },
    { label: "In production", value: inProduction, tab: "production" },
    { label: "Ready to ship", value: readyToShip, tab: "production" },
  ];

  // --- Alerts: overdue jobs (due in the past, not completed/cancelled) ---
  const overdue = orders
    .filter(
      (o) =>
        o.order.due_date &&
        !has(CLOSED_STATUSES, o.order.status) &&
        daysOverdue(o.order.due_date) > 0
    )
    .sort((a, b) => daysOverdue(b.order.due_date!) - daysOverdue(a.order.due_date!));

  // --- Recent activity (latest 10), with order_number resolved by id ---
  const supabase = requireSupabaseServiceClient();
  const { data: activityRows } = await supabase
    .from("order_activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  const activity = (activityRows ?? []) as OrderActivityRow[];

  const orderNumberById = new Map(orders.map((o) => [o.order.id, o.order.order_number]));

  return (
    <div>
      <AdminHeader title="Dashboard" />
      <div className="space-y-8 px-8 py-6">
        {denied && (
          <div className="rounded-lg bg-dream-warn-soft px-4 py-3 text-sm text-dream-warn">
            You don&apos;t have permission to access <strong>{denied}</strong>.
          </div>
        )}

        <p className="text-dream-muted">
          Welcome back, {profile.name || "team"}. Here&apos;s where the shop stands right now.
        </p>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={`/admin/orders?tab=${s.tab}`}
              className="rounded-xl border border-dream-line bg-dream-surface p-4 transition-colors hover:border-dream-purple"
            >
              <div className="font-display text-3xl font-bold text-dream-ink">{s.value}</div>
              <div className="text-sm text-dream-muted">{s.label}</div>
            </Link>
          ))}
          <div className="rounded-xl border border-dream-line bg-dream-surface p-4">
            <div className="font-display text-3xl font-bold text-dream-ink">{formatCAD(outstanding)}</div>
            <div className="text-sm text-dream-muted">Outstanding balance</div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Alerts: overdue jobs */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-dream-ink">Alerts</h2>
            {overdue.length === 0 ? (
              <div className="rounded-xl border border-dream-line bg-dream-surface">
                <EmptyState title="Nothing overdue" description="Every job with a due date is on schedule." />
              </div>
            ) : (
              <ul className="divide-y divide-dream-line overflow-hidden rounded-xl border border-dream-line bg-dream-surface">
                {overdue.map((o) => {
                  const meta = STATUS_META[o.order.status as OrderStatus];
                  const late = daysOverdue(o.order.due_date!);
                  return (
                    <li key={o.order.id}>
                      <Link
                        href={`/admin/orders/${o.order.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-dream-bg"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-dream-ink">
                            {o.order.order_number ?? o.customerName ?? o.customerEmail ?? "Order"}
                          </div>
                          <div className="text-xs text-dream-muted">
                            {o.customerName ?? o.customerEmail ?? "—"} · due {o.order.due_date}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="danger">{late}d overdue</Badge>
                          <Badge variant={meta?.badge ?? "neutral"}>{meta?.label ?? o.order.status}</Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Recent activity feed */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-dream-ink">Recent activity</h2>
            {activity.length === 0 ? (
              <div className="rounded-xl border border-dream-line bg-dream-surface">
                <EmptyState title="No activity yet" description="Status changes, new orders and approvals show up here." />
              </div>
            ) : (
              <ul className="divide-y divide-dream-line overflow-hidden rounded-xl border border-dream-line bg-dream-surface">
                {activity.map((a) => {
                  const orderNumber = orderNumberById.get(a.order_id);
                  return (
                    <li key={a.id} className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${a.order_id}`}
                        className="-mx-4 -my-3 block px-4 py-3 transition-colors hover:bg-dream-bg"
                      >
                        <div className="text-sm text-dream-ink">
                          <span className="font-medium">{a.actor_name ?? "Staff"}</span>{" "}
                          <span className="text-dream-muted">{a.type.replace(/_/g, " ")}</span>
                          {orderNumber && <span className="text-dream-muted"> on {orderNumber}</span>}
                        </div>
                        <div className="text-xs text-dream-faint">
                          {new Date(a.created_at).toLocaleString("en-CA")}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
