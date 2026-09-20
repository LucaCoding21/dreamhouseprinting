"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { STATUS_META } from "@/lib/orderStatus";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/rows";

interface Row {
  id: string;
  orderNumber: string | null;
  status: string;
  isRush: boolean;
  paymentStatus: string;
  paymentMethod: string | null;
  etransferReportedAt: string | null;
  invoiceSentAt: string | null;
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
  salesRep: string | null;
  customerName: string | null;
  customerEmail: string | null;
  pieces: number;
  total: number;
  mockups: string[];
  latestNote: string | null;
}

/** Payment badge: paid > e-transfer to verify (amber) > invoiced (amber) > unpaid (neutral). */
function paymentMeta(r: Row): { label: string; variant: "success" | "warn" | "info" | "neutral" } {
  if (r.paidAt || r.paymentStatus === "paid_in_full") {
    return { label: r.paymentMethod === "etransfer" ? "Paid by e-transfer" : "Paid", variant: "success" };
  }
  if (r.etransferReportedAt) {
    const short = new Date(r.etransferReportedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    return { label: `E-transfer sent ${short}`, variant: "warn" };
  }
  if (r.invoiceSentAt) {
    const short = new Date(r.invoiceSentAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    return { label: `Invoiced ${short}`, variant: "warn" };
  }
  return { label: "Unpaid", variant: "neutral" };
}

/** Text colour per badge tone, for the pill-free phone rows. */
const TONE: Record<string, string> = {
  neutral: "text-dream-muted",
  success: "text-dream-success",
  warn: "text-dream-warn",
  danger: "text-dream-danger",
  info: "text-dream-info",
  purple: "text-dream-purple",
};

// Rush orders that are out the door (shipped/picked up/done) or cancelled are no
// longer "active", the Rush tab surfaces only the ones still needing attention.
const CLOSED_STATUSES = ["shipped", "ready_for_pickup", "completed", "cancelled"];

const TABS: { key: string; label: string; match: (r: Row) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "new", label: "Creating mockup", match: (r) => r.status === "submitted" || r.status === "in_review" },
  { key: "proofing", label: "Pending approval", match: (r) => r.status === "proof_ready" },
  { key: "declined", label: "Mockup declined", match: (r) => r.status === "changes_requested" },
  { key: "rush", label: "Rush orders", match: (r) => r.isRush && !CLOSED_STATUSES.includes(r.status) },
  { key: "production", label: "In production", match: (r) => ["approved", "in_production", "quality_check"].includes(r.status) },
  { key: "shipped", label: "Shipped", match: (r) => ["shipped", "ready_for_pickup", "completed"].includes(r.status) },
  { key: "archived", label: "Archived", match: (r) => r.status === "cancelled" },
];

function inHands(due: string | null): { label: string; urgent: boolean } {
  if (!due) return { label: "-", urgent: false };
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `${-days}d overdue`, urgent: true };
  if (days === 0) return { label: "Today", urgent: true };
  return { label: `${days}d left`, urgent: days <= 3 };
}

export function OrdersListClient({
  rows,
  initialTab,
  headerAction,
}: {
  rows: Row[];
  initialTab?: string;
  /** Rendered in the sticky header (the "New order" button). */
  headerAction?: React.ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(
    initialTab && TABS.some((t) => t.key === initialTab) ? initialTab : "all"
  );
  const [query, setQuery] = useState("");

  // Filters, layered on top of the tab + search. Each is "any" until picked;
  // the bar shows a Clear link once something is set.
  const [payFilter, setPayFilter] = useState<"any" | "unpaid" | "paid" | "etransfer" | "invoiced">("any");
  const [statusFilter, setStatusFilter] = useState<"any" | OrderStatus>("any");
  const [repFilter, setRepFilter] = useState("any");
  const [rushOnly, setRushOnly] = useState(false);
  const [sort, setSort] = useState<"due" | "newest" | "oldest" | "total-desc" | "total-asc">("due");
  const reps = Array.from(new Set(rows.map((r) => r.salesRep).filter((v): v is string => !!v))).sort();
  const filtersActive = payFilter !== "any" || statusFilter !== "any" || repFilter !== "any" || rushOnly;
  function clearFilters() {
    setPayFilter("any");
    setStatusFilter("any");
    setRepFilter("any");
    setRushOnly(false);
  }
  const matchesFilters = (r: Row) => {
    if (statusFilter !== "any" && r.status !== statusFilter) return false;
    if (repFilter !== "any" && r.salesRep !== repFilter) return false;
    if (rushOnly && !r.isRush) return false;
    if (payFilter !== "any") {
      const paid = !!r.paidAt || r.paymentStatus === "paid_in_full";
      if (payFilter === "paid" && !paid) return false;
      if (payFilter === "unpaid" && paid) return false;
      if (payFilter === "etransfer" && !(r.etransferReportedAt && !paid)) return false;
      if (payFilter === "invoiced" && !(r.invoiceSentAt && !paid)) return false;
    }
    return true;
  };
  const sortRows = (a: Row, b: Row) => {
    switch (sort) {
      case "newest":
        return b.createdAt.localeCompare(a.createdAt);
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "total-desc":
        return b.total - a.total;
      case "total-asc":
        return a.total - b.total;
      default: {
        // In-hands soonest first; undated orders sink to the bottom.
        if (!a.dueDate && !b.dueDate) return b.createdAt.localeCompare(a.createdAt);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
    }
  };

  const count = (m: (r: Row) => boolean) => rows.filter(m).length;
  const tabMatch = (key: string) => TABS.find((t) => t.key === key)!.match;
  // Each card counts exactly what its tab shows, so clicking never changes the number.
  const stats = [
    { label: "Open orders", tab: "all", value: rows.filter((r) => !["completed", "cancelled"].includes(r.status)).length },
    { label: "Awaiting approval", tab: "proofing", value: count(tabMatch("proofing")) },
    { label: "In production", tab: "production", value: count(tabMatch("production")) },
    { label: "Shipped", tab: "shipped", value: count(tabMatch("shipped")) },
  ];

  // Search narrows what the active tab shows; the tab counts above stay
  // unfiltered so the numbers keep matching the stat cards.
  const q = query.trim().toLowerCase();
  const matchesQuery = (r: Row) =>
    !q ||
    [r.orderNumber, r.customerName, r.customerEmail].some((v) => v?.toLowerCase().includes(q));

  const visible = rows
    .filter((r) => TABS.find((t) => t.key === tab)!.match(r) && matchesQuery(r) && matchesFilters(r))
    .sort(sortRows);

  return (
    <div>
      <AdminHeader title="Orders">{headerAction}</AdminHeader>
      <div className="px-4 py-6 sm:px-8">
        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setTab(s.tab)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors sm:p-4",
                tab === s.tab
                  ? "border-dream-purple bg-dream-surface"
                  : "border-dream-line bg-dream-surface hover:border-dream-purple/50"
              )}
            >
              <div className="font-display text-xl font-semibold tabular-nums tracking-normal text-dream-ink">{s.value}</div>
              <div className="mt-0.5 text-[13px] text-dream-muted">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Search + filters: stacked on phones (search first), one row from
            md with the search pinned to the right. */}
        <div className="mb-4 md:flex md:items-center md:gap-2">
        <div className="relative mb-4 max-w-full sm:max-w-sm md:order-last md:mb-0 md:ml-auto md:w-72">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dream-faint"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders"
            aria-label="Search orders"
            className="pl-9"
          />
        </div>

        {/* Filters + sort. Selects side-scroll in one row on phones. */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar md:min-w-0 md:flex-wrap md:overflow-x-visible">
          <Select value={payFilter} onChange={(e) => setPayFilter(e.target.value as typeof payFilter)} aria-label="Filter by payment" className="w-auto min-w-36">
            <option value="any">Any payment</option>
            <option value="unpaid">Unpaid</option>
            <option value="invoiced">Invoiced, unpaid</option>
            <option value="etransfer">E-transfer to verify</option>
            <option value="paid">Paid</option>
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status" className="w-auto min-w-36">
            <option value="any">Any status</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_META[st].label}
              </option>
            ))}
          </Select>
          {reps.length > 0 && (
            <Select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} aria-label="Filter by sales rep" className="w-auto min-w-36">
              <option value="any">Any sales rep</option>
              {reps.map((rep) => (
                <option key={rep} value={rep}>
                  {rep}
                </option>
              ))}
            </Select>
          )}
          <button
            type="button"
            aria-pressed={rushOnly}
            onClick={() => setRushOnly((v) => !v)}
            className={cn(
              "inline-flex h-[38px] shrink-0 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
              rushOnly ? "border-dream-purple bg-dream-purple text-white" : "border-dream-line bg-white text-dream-ink hover:border-dream-purple/50",
            )}
          >
            Rush only
          </button>
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort orders" className="w-auto min-w-40">
            <option value="due">Sort: In hands soonest</option>
            <option value="newest">Sort: Newest first</option>
            <option value="oldest">Sort: Oldest first</option>
            <option value="total-desc">Sort: Total, high to low</option>
            <option value="total-asc">Sort: Total, low to high</option>
          </Select>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="shrink-0 px-2 text-sm font-medium text-dream-purple hover:underline">
              Clear filters
            </button>
          )}
        </div>
        </div>

        {/* Tabs: one scrolling row on phones (the page itself cannot scroll
            sideways, body is overflow-x clipped), the usual wrap from md up. */}
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-dream-line no-scrollbar md:flex-wrap md:overflow-x-visible">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                tab === t.key ? "border-dream-purple text-dream-purple" : "border-transparent text-dream-muted hover:text-dream-ink"
              )}
            >
              {t.label}
              {/* Counts only from md: on a phone the number crowding the
                  label read badly, and the stat cards above already count. */}
              <span className="ml-2 hidden text-dream-faint md:inline">{count(t.match)}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No orders here" description="Orders placed in the designer land here automatically." />
        ) : (
          <>
            {/* Phones: the 8-column table is unreadable, so the same rows render
                as a tap-through list at the same density as the dashboard queues. */}
            <div className="divide-y divide-dream-line overflow-hidden rounded-xl border border-dream-line bg-dream-surface md:hidden">
              {visible.map((r) => {
                const meta = STATUS_META[r.status as OrderStatus];
                const ih = inHands(r.dueDate);
                const pay = paymentMeta(r);
                const thumb = r.mockups[0];
                return (
                  <Link
                    key={r.id}
                    href={`/admin/orders/${r.id}`}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-dream-lavender-mist"
                  >
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded border border-dream-line bg-dream-bg">
                      {thumb && (
                        <Image src={thumb} alt="" width={44} height={44} className="h-full w-full object-contain" />
                      )}
                    </div>
                    {/* No pills on the phone row: status is a coloured word
                        under the customer, payment a small word under the
                        price, so each card is two quiet columns. */}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-dream-ink">{r.orderNumber ?? "Order"}</div>
                      <div className="truncate text-xs text-dream-muted">
                        {r.customerName ?? r.customerEmail ?? "-"}
                      </div>
                      <div className={cn("mt-0.5 truncate text-xs font-medium", TONE[meta?.badge ?? "neutral"])}>
                        {meta?.label ?? r.status}
                      </div>
                      {r.latestNote && (
                        <div className="mt-1 truncate text-xs text-dream-muted">{r.latestNote}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium text-dream-ink">{formatCAD(r.total)}</div>
                      <div className={cn("text-xs", TONE[pay.variant])}>{pay.label}</div>
                      <div className={cn("mt-0.5 text-xs", ih.urgent ? "text-dream-danger" : "text-dream-muted")}>
                        {ih.label}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="hidden rounded-xl border border-dream-line bg-dream-surface md:block">
            <Table>
              <THead>
                <TR>
                  <TH>In hands</TH>
                  <TH>Status</TH>
                  <TH>Payment</TH>
                  <TH>Customer</TH>
                  <TH>Sales rep</TH>
                  <TH>Pieces / total</TH>
                  <TH>Latest note</TH>
                  <TH>Mockups</TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((r) => {
                  const meta = STATUS_META[r.status as OrderStatus];
                  const ih = inHands(r.dueDate);
                  const pay = paymentMeta(r);
                  return (
                    <TR key={r.id} className="cursor-pointer" onClick={() => router.push(`/admin/orders/${r.id}`)}>
                      <TD className="whitespace-nowrap">
                        <div className="font-medium text-dream-ink">{r.dueDate ?? "-"}</div>
                        <div className={cn("text-xs", ih.urgent ? "text-dream-danger" : "text-dream-muted")}>{ih.label}</div>
                      </TD>
                      {/* Same coloured-word treatment as the phone cards, no
                          pills, so the two layouts read as one design. */}
                      <TD className="whitespace-nowrap">
                        <span className={cn("font-medium", TONE[meta?.badge ?? "neutral"])}>{meta?.label ?? r.status}</span>
                      </TD>
                      <TD className="whitespace-nowrap">
                        <span className={cn("font-medium", TONE[pay.variant])}>{pay.label}</span>
                      </TD>
                      <TD>
                        <div className="font-medium text-dream-ink">{r.customerName ?? r.customerEmail ?? "-"}</div>
                        <div className="text-xs text-dream-muted">{r.orderNumber}</div>
                      </TD>
                      <TD>{r.salesRep ?? "-"}</TD>
                      <TD>
                        <div className="font-medium text-dream-ink">{r.pieces} pcs</div>
                        <div className="text-xs text-dream-muted">{formatCAD(r.total)}</div>
                      </TD>
                      <TD className="max-w-[220px]">
                        <span className="line-clamp-2 text-sm text-dream-muted">{r.latestNote ?? "No notes"}</span>
                      </TD>
                      <TD>
                        <div className="flex -space-x-2">
                          {r.mockups.map((m, i) => (
                            <div key={i} className="h-8 w-8 overflow-hidden rounded border border-dream-line bg-dream-bg">
                              <Image src={m} alt="" width={32} height={32} className="h-full w-full object-contain" />
                            </div>
                          ))}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
