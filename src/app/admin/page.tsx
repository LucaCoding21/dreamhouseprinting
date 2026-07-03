import Link from "next/link";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { getAdminOrders } from "@/lib/admin/orders";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { formatCAD } from "@/lib/money";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus, OrderActivityRow } from "@/lib/db/rows";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Dashboard | Admin" };

const NEW_STATUSES = ["submitted", "in_review"];
const PROOF_STATUSES = ["proof_ready", "changes_requested"];
const PRODUCTION_STATUSES = ["approved", "in_production", "quality_check"];
const FULFILMENT_STATUSES = ["quality_check", "shipped"];
const CLOSED_STATUSES = ["completed", "cancelled"];

function daysOverdue(due: string): number {
  return Math.ceil((Date.now() - new Date(due).getTime()) / 86400000);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

// One glyph + colour per activity type, so the feed reads as a scannable rail.
const ICONS: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  repeat: (
    <>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  note: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  dollar: (
    <>
      <path d="M12 1v22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-6.8-6.8V4h9.8l7 7a2 2 0 0 1 0 2.4z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
};

const ACTIVITY_META: Record<string, { label: string; tone: string; icon: string }> = {
  order_created: { label: "New order", tone: "bg-dream-lavender-soft text-dream-purple", icon: "plus" },
  reorder: { label: "Reorder placed", tone: "bg-dream-lavender-soft text-dream-purple", icon: "repeat" },
  status_change: { label: "Status changed", tone: "bg-dream-info-soft text-dream-periwinkle", icon: "arrow" },
  proof_uploaded: { label: "Proof uploaded", tone: "bg-dream-sun-soft text-dream-warn", icon: "image" },
  proof_approved: { label: "Proof approved", tone: "bg-dream-success-soft text-dream-success", icon: "check" },
  changes_requested: { label: "Changes requested", tone: "bg-dream-danger-soft text-dream-danger", icon: "pencil" },
  note: { label: "Note added", tone: "bg-dream-line text-dream-muted", icon: "note" },
  payment_status: { label: "Payment updated", tone: "bg-dream-success-soft text-dream-success", icon: "dollar" },
  price_edit: { label: "Pricing updated", tone: "bg-dream-line text-dream-muted", icon: "tag" },
  details_updated: { label: "Details updated", tone: "bg-dream-line text-dream-muted", icon: "pencil" },
  items_updated: { label: "Items updated", tone: "bg-dream-line text-dream-muted", icon: "tag" },
  item_removed: { label: "Item removed", tone: "bg-dream-danger-soft text-dream-danger", icon: "pencil" },
};

function ActivityIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      {ICONS[name] ?? ICONS.note}
    </svg>
  );
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
                  const meta =
                    ACTIVITY_META[a.type] ?? {
                      label: a.type.replace(/_/g, " "),
                      tone: "bg-dream-line text-dream-muted",
                      icon: "note",
                    };
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/admin/orders/${a.order_id}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-dream-bg"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
                        >
                          <ActivityIcon name={meta.icon} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-dream-ink">
                            <span className="font-semibold">{meta.label}</span>
                            {orderNumber && (
                              <>
                                <span className="text-dream-faint"> · </span>
                                <span className="font-medium text-dream-purple">{orderNumber}</span>
                              </>
                            )}
                          </div>
                          <div className="truncate text-xs text-dream-muted">
                            {a.actor_name ?? "Staff"}
                          </div>
                        </div>
                        <time
                          dateTime={a.created_at}
                          title={new Date(a.created_at).toLocaleString("en-CA")}
                          className="shrink-0 whitespace-nowrap text-xs text-dream-faint"
                        >
                          {relativeTime(a.created_at)}
                        </time>
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
