"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/rows";

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
    return { label: r.paymentMethod === "etransfer" ? "Paid · e-transfer" : "Paid", variant: "success" };
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

// Rush orders that are out the door (shipped/picked up/done) or cancelled are no
// longer "active", the Rush tab surfaces only the ones still needing attention.
const CLOSED_STATUSES = ["shipped", "ready_for_pickup", "completed", "cancelled"];

const TABS: { key: string; label: string; match: (r: Row) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "new", label: "New", match: (r) => r.status === "submitted" || r.status === "in_review" },
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

  const count = (m: (r: Row) => boolean) => rows.filter(m).length;
  const stats = [
    { label: "Open orders", value: rows.filter((r) => !["completed", "cancelled"].includes(r.status)).length },
    { label: "Awaiting approval", value: count((r) => r.status === "proof_ready" || r.status === "changes_requested") },
    { label: "In production", value: count((r) => ["approved", "in_production", "quality_check"].includes(r.status)) },
    { label: "Shipped", value: count((r) => ["shipped", "ready_for_pickup"].includes(r.status)) },
  ];

  const visible = rows.filter((r) => TABS.find((t) => t.key === tab)!.match(r));

  return (
    <div>
      <AdminHeader title="Orders">{headerAction}</AdminHeader>
      <div className="px-8 py-6">
        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-dream-line bg-dream-surface p-4">
              <div className="font-display text-3xl font-bold text-dream-ink">{s.value}</div>
              <div className="text-sm text-dream-muted">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-1 border-b border-dream-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium",
                tab === t.key ? "border-dream-purple text-dream-purple" : "border-transparent text-dream-muted hover:text-dream-ink"
              )}
            >
              {t.label} <span className="text-dream-faint">{count(t.match)}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No orders here" description="Orders placed in the designer land here automatically." />
        ) : (
          <div className="rounded-xl border border-dream-line bg-dream-surface">
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
                      <TD>
                        <div className="font-medium text-dream-ink">{r.dueDate ?? "-"}</div>
                        <div className={cn("text-xs", ih.urgent ? "text-dream-danger" : "text-dream-muted")}>{ih.label}</div>
                      </TD>
                      <TD>
                        <Badge variant={meta?.badge ?? "neutral"}>{meta?.label ?? r.status}</Badge>
                      </TD>
                      <TD>
                        <Badge variant={pay.variant}>{pay.label}</Badge>
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
        )}
      </div>
    </div>
  );
}
