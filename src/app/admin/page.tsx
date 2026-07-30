import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { requireStaff, hasPermission } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { getAdminOrders, type AdminOrderListItem } from "@/lib/admin/orders";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { formatCAD } from "@/lib/money";
import type { OrderActivityRow, ProfileRow } from "@/lib/db/rows";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuoteRequests, type QuoteRequestItem } from "./QuoteRequests";

export const metadata = { title: "Dashboard | Admin" };

const CLOSED_STATUSES = ["completed", "cancelled"];
// Orders that are approved-or-beyond but not yet closed (invoice / production range).
const ACTIVE_FULFILMENT = ["approved", "in_production", "quality_check", "shipped", "ready_for_pickup"];
const PRODUCTION_STATUSES = ["approved", "in_production", "quality_check"];

function daysFromNow(due: string): number {
  return Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
}

function dueMeta(due: string | null): { label: string; tone: string } | null {
  if (!due) return null;
  const d = daysFromNow(due);
  if (d < 0) return { label: `${-d}d overdue`, tone: "text-dream-danger" };
  if (d === 0) return { label: "Due today", tone: "text-dream-danger" };
  if (d <= 3) return { label: `${d}d left`, tone: "text-dream-warn" };
  return { label: `${d}d left`, tone: "text-dream-muted" };
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
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </>
  ),
  truck: (
    <>
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>
  ),
};

const ACTIVITY_META: Record<string, { label: string; tone: string; icon: string }> = {
  order_created: { label: "New order", tone: "bg-dream-lavender-soft text-dream-purple", icon: "plus" },
  reorder: { label: "Reorder placed", tone: "bg-dream-lavender-soft text-dream-purple", icon: "repeat" },
  status_change: { label: "Status changed", tone: "bg-dream-info-soft text-dream-info", icon: "arrow" },
  proof_uploaded: { label: "Proof uploaded", tone: "bg-dream-sun-soft text-dream-warn", icon: "image" },
  proof_approved: { label: "Proof approved", tone: "bg-dream-success-soft text-dream-success", icon: "check" },
  changes_requested: { label: "Changes requested", tone: "bg-dream-danger-soft text-dream-danger", icon: "pencil" },
  note: { label: "Note added", tone: "bg-dream-line text-dream-muted", icon: "note" },
  payment_status: { label: "Payment updated", tone: "bg-dream-success-soft text-dream-success", icon: "dollar" },
  payment_received: { label: "Payment received", tone: "bg-dream-success-soft text-dream-success", icon: "dollar" },
  invoice_sent: { label: "Invoice sent", tone: "bg-dream-info-soft text-dream-info", icon: "send" },
  tracking_updated: { label: "Tracking updated", tone: "bg-dream-info-soft text-dream-info", icon: "truck" },
  price_edit: { label: "Pricing updated", tone: "bg-dream-line text-dream-muted", icon: "tag" },
  details_updated: { label: "Details updated", tone: "bg-dream-line text-dream-muted", icon: "pencil" },
  items_updated: { label: "Items updated", tone: "bg-dream-line text-dream-muted", icon: "tag" },
  item_removed: { label: "Item removed", tone: "bg-dream-danger-soft text-dream-danger", icon: "pencil" },
  order_edited: { label: "Order edited", tone: "bg-dream-line text-dream-muted", icon: "pencil" },
  approval_sent: { label: "Sent for approval", tone: "bg-dream-info-soft text-dream-info", icon: "send" },
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

interface Queue {
  key: string;
  title: string;
  tab: string; // deep-links to /admin/orders?tab=<tab>
  items: AdminOrderListItem[];
}

// A queue is a to-do preview, not a list. Needs proof alone can run 40 orders
// deep, so every card caps its rows and hands the rest to /admin/orders, where
// the same set has filters, sorting and the full table.
const QUEUE_PREVIEW = 7;

function QueueCard({ queue }: { queue: Queue }) {
  const total = queue.items.length;
  const rows = queue.items.slice(0, QUEUE_PREVIEW);
  const hidden = total - rows.length;
  const tabHref = `/admin/orders?tab=${queue.tab}`;
  return (
    <section id={`q-${queue.key}`} className="rounded-xl border border-dream-line bg-dream-surface">
      <div className="flex items-center justify-between gap-2 border-b border-dream-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-bold text-dream-ink">{queue.title}</h2>
          <Badge variant={total ? "purple" : "neutral"}>{total}</Badge>
        </div>
        <Link href={tabHref} className="text-xs font-medium text-dream-purple hover:underline">
          {hidden > 0 ? `View all ${total}` : "View all"}
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-dream-muted">Nothing here right now.</div>
      ) : (
        <ul className="divide-y divide-dream-line">
          {rows.map((o) => {
            const due = dueMeta(o.order.due_date);
            const thumb = o.mockups[0];
            return (
              <li key={o.order.id}>
                <Link
                  href={`/admin/orders/${o.order.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-dream-bg"
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded border border-dream-line bg-dream-bg">
                    {thumb && (
                      <Image src={thumb} alt="" width={36} height={36} className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-dream-ink">
                      {o.order.order_number ?? o.customerName ?? o.customerEmail ?? "Order"}
                    </div>
                    <div className="truncate text-xs text-dream-muted">
                      {o.customerName ?? o.customerEmail ?? "-"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium text-dream-ink">{formatCAD(o.total)}</div>
                    {due && <div className={`text-xs ${due.tone}`}>{due.label}</div>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 && (
        <Link
          href={tabHref}
          className="flex items-center justify-between gap-2 border-t border-dream-line px-4 py-2.5 text-sm font-medium text-dream-purple transition-colors hover:bg-dream-bg"
        >
          <span>
            {hidden} more {hidden === 1 ? "order" : "orders"} in this queue
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide">View all {total}</span>
        </Link>
      )}
    </section>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  // Everything independent races in parallel: auth, orders, open quotes and
  // the activity feed. Permission-gated sections are filtered after the fact
  // (service-role reads never reach the client when the gate fails).
  const supabase = requireSupabaseServiceClient();
  const [profile, { denied }, orders, { data: quoteRows }, { data: activityRows }] =
    await Promise.all([
      requireStaff(),
      searchParams,
      getAdminOrders(),
      supabase
        .from("quotes")
        .select("*")
        .in("status", ["requested", "sent"])
        .order("created_at", { ascending: false }),
      supabase
        .from("order_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const inStatus = (statuses: string[], o: AdminOrderListItem) => statuses.includes(o.order.status);

  // --- Action queues (the morning to-do view) ---
  const needsProof = orders.filter((o) => inStatus(["submitted", "in_review"], o));
  const awaitingApproval = orders.filter((o) => o.order.status === "proof_ready");
  const changesRequested = orders.filter((o) => o.order.status === "changes_requested");
  // Customer clicked "I've sent the e-transfer": Julian checks the bank and
  // confirms on the order. Its own queue, since the ball is in HIS court
  // (unlike Awaiting payment, where the customer still has to act).
  const etransferVerify = orders.filter(
    (o) => o.order.etransfer_reported_at && !o.order.paid_at && o.order.status !== "cancelled"
  );
  // Approve-and-pay: approved-or-beyond unpaid orders are payable self-serve
  // from the customer's order page, one queue, whether or not a payment-link
  // email (invoice) also went out. Reported e-transfers live in their own
  // queue above, not here.
  const awaitingPayment = orders.filter(
    (o) =>
      (inStatus(ACTIVE_FULFILMENT, o) || o.order.invoice_sent_at) &&
      !o.order.paid_at &&
      !o.order.etransfer_reported_at &&
      o.order.payment_status === "unpaid" &&
      o.order.status !== "cancelled"
  );
  const inProduction = orders.filter((o) => inStatus(PRODUCTION_STATUSES, o));
  const dueSoon = orders
    .filter(
      (o) =>
        o.order.due_date &&
        !inStatus(CLOSED_STATUSES, o) &&
        daysFromNow(o.order.due_date) <= 3
    )
    .sort((a, b) => daysFromNow(a.order.due_date!) - daysFromNow(b.order.due_date!));

  const queues: Queue[] = [
    { key: "needs-proof", title: "Needs proof", tab: "new", items: needsProof },
    { key: "awaiting-approval", title: "Awaiting customer approval", tab: "proofing", items: awaitingApproval },
    { key: "changes-requested", title: "Changes requested", tab: "declined", items: changesRequested },
    { key: "etransfer-verify", title: "E-transfers to verify", tab: "production", items: etransferVerify },
    { key: "awaiting-payment", title: "Awaiting payment", tab: "production", items: awaitingPayment },
    { key: "in-production", title: "In production", tab: "production", items: inProduction },
    { key: "due-soon", title: "Due soon / overdue", tab: "all", items: dueSoon },
  ];

  // Outstanding balance: orders not paid in full and not cancelled.
  const outstanding = orders
    .filter((o) => o.order.payment_status !== "paid_in_full" && o.order.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);

  // --- Quote requests (open only), mirrors the old quotes loader, thumbnail via designs ---
  const canManageQuotes = hasPermission(profile, "quotes.manage");
  let quoteItems: QuoteRequestItem[] = [];
  if (canManageQuotes) {
    const rowsRaw = quoteRows ?? [];

    const customerIds = [...new Set(rowsRaw.map((q) => q.customer_id).filter(Boolean))] as string[];
    const designIds = [...new Set(rowsRaw.flatMap((q) => q.design_ids ?? []))] as string[];

    const [{ data: profiles }, designMockups] = await Promise.all([
      customerIds.length
        ? supabase.from("profiles").select("id, name, email").in("id", customerIds)
        : Promise.resolve({ data: [] as Pick<ProfileRow, "id" | "name" | "email">[] }),
      (async () => {
        const map = new Map<string, string | null>();
        if (designIds.length) {
          const { data: designs } = await supabase
            .from("designs")
            .select("id, mockup_images")
            .in("id", designIds);
          for (const d of designs ?? []) {
            const m = ((d.mockup_images ?? []) as unknown as { url: string | null }[]).find((x) => x.url)?.url ?? null;
            map.set(d.id, m);
          }
        }
        return map;
      })(),
    ]);
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    quoteItems = rowsRaw.map((q) => {
      const p = q.customer_id ? profileById.get(q.customer_id) : undefined;
      const contact = (q.contact ?? {}) as unknown as { name?: string; email?: string };
      const pricing = (q.pricing ?? {}) as unknown as { total?: number };
      const thumbnail = (q.design_ids ?? []).map((id) => designMockups.get(id)).find(Boolean) ?? null;
      return {
        id: q.id,
        quoteNumber: q.quote_number,
        customerName: p?.name ?? contact.name ?? null,
        customerEmail: p?.email ?? contact.email ?? null,
        message: q.message,
        total: pricing.total ?? 0,
        thumbnail: thumbnail ?? null,
      };
    });
  }

  // --- Recent activity (latest 10), with order_number resolved by id ---
  const activity = (activityRows ?? []) as OrderActivityRow[];
  const orderNumberById = new Map(orders.map((o) => [o.order.id, o.order.order_number]));

  const canViewReports = hasPermission(profile, "reports.view");

  // Top strip: one clickable chip per queue, anchoring to its card.
  const chips = queues.filter((q) => q.items.length > 0);

  return (
    <div>
      <AdminHeader title="Dashboard">
        {canViewReports && (
          <a
            href="/api/admin/reports/orders.csv"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-dream-line bg-white px-4 text-sm font-display font-medium text-dream-ink transition-colors hover:bg-dream-bg"
            download
          >
            Download CSV
          </a>
        )}
      </AdminHeader>

      <div className="space-y-8 px-8 py-6">
        {denied && (
          <div className="rounded-lg bg-dream-warn-soft px-4 py-3 text-sm text-dream-warn">
            You don&apos;t have permission to access <strong>{denied}</strong>.
          </div>
        )}

        <p className="text-dream-muted">
          Welcome back, {profile.name || "team"}. Here&apos;s what needs your attention today.
        </p>

        {/* Unpaid balance, a read-only summary stat, plain stacked text (no box)
            so it's clearly a figure, not a clickable chip. Sits above the chips. */}
        <div title="Total value of orders that haven't been paid in full yet (excludes cancelled orders).">
          <div className="text-xs font-semibold uppercase tracking-wide text-dream-muted">Unpaid balance</div>
          <div className="mt-0.5 font-display text-3xl font-extrabold text-dream-ink">{formatCAD(outstanding)}</div>
        </div>

        {/* Top strip: clickable count chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((q) => (
              <a
                key={q.key}
                href={`#q-${q.key}`}
                className="inline-flex items-center gap-2 rounded-full border border-dream-line bg-dream-surface px-3 py-1.5 text-sm font-medium text-dream-ink transition-colors hover:border-dream-purple"
              >
                {q.title}
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-dream-lavender-soft px-1.5 text-xs font-bold text-dream-purple">
                  {q.items.length}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Queue cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          {queues.map((q) => (
            <QueueCard key={q.key} queue={q} />
          ))}
        </div>

        {/* Quote requests (gated by quotes.manage) */}
        {canManageQuotes && <QuoteRequests quotes={quoteItems} />}

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
                        <div className="truncate text-xs text-dream-muted">{a.actor_name ?? "Staff"}</div>
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
  );
}
