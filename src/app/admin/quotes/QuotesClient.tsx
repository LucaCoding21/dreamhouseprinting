"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { setQuoteStatusAction, convertQuoteToOrderAction } from "./actions";

type QuoteStatus = "requested" | "sent" | "accepted" | "declined" | "converted";

export interface QuoteListItem {
  id: string;
  quoteNumber: string | null;
  status: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  message: string | null;
  total: number;
  designCount: number;
  thumbnail: string | null;
  convertedOrderId: string | null;
}

const STATUS_META: Record<QuoteStatus, { label: string; badge: BadgeVariant }> = {
  requested: { label: "Requested", badge: "info" },
  sent: { label: "Sent", badge: "purple" },
  accepted: { label: "Accepted", badge: "success" },
  declined: { label: "Declined", badge: "danger" },
  converted: { label: "Converted", badge: "success" },
};

function statusMeta(status: string): { label: string; badge: BadgeVariant } {
  return STATUS_META[status as QuoteStatus] ?? { label: status, badge: "neutral" };
}

const TABS: { key: string; label: string; match: (s: string) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "requested", label: "Requested", match: (s) => s === "requested" },
  { key: "sent", label: "Sent", match: (s) => s === "sent" },
  { key: "accepted", label: "Accepted", match: (s) => s === "accepted" },
  { key: "declined", label: "Declined", match: (s) => s === "declined" },
  { key: "converted", label: "Converted", match: (s) => s === "converted" },
];

export function QuotesClient({ rows }: { rows: QuoteListItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();

  const count = (m: (s: string) => boolean) => rows.filter((r) => m(r.status)).length;
  const stats = [
    { label: "Open requests", value: count((s) => s === "requested") },
    { label: "Awaiting reply", value: count((s) => s === "sent") },
    { label: "Accepted", value: count((s) => s === "accepted") },
    { label: "Converted", value: count((s) => s === "converted") },
  ];

  const visible = rows.filter((r) => TABS.find((t) => t.key === tab)!.match(r.status));

  function runStatus(quoteId: string, status: QuoteStatus, okMsg: string) {
    setPendingId(quoteId);
    start(async () => {
      const res = await setQuoteStatusAction(quoteId, status);
      setPendingId(null);
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: okMsg, variant: "success" });
        router.refresh();
      }
    });
  }

  function runConvert(quoteId: string) {
    setPendingId(quoteId);
    start(async () => {
      const res = await convertQuoteToOrderAction(quoteId);
      setPendingId(null);
      if (res.error) toast({ title: "Could not convert", description: res.error, variant: "error" });
      else {
        toast({ title: "Order created from quote", variant: "success" });
        if (res.orderId) router.push(`/admin/orders/${res.orderId}`);
        else router.refresh();
      }
    });
  }

  return (
    <div>
      <AdminHeader title="Quotes" />
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
                tab === t.key
                  ? "border-dream-purple text-dream-purple"
                  : "border-transparent text-dream-muted hover:text-dream-ink"
              )}
            >
              {t.label} <span className="text-dream-faint">{count(t.match)}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="No quote requests here"
            description="Quotes saved from the designer land here automatically."
          />
        ) : (
          <div className="rounded-xl border border-dream-line bg-dream-surface">
            <Table>
              <THead>
                <TR>
                  <TH>Design</TH>
                  <TH>Customer</TH>
                  <TH>Message</TH>
                  <TH>Status</TH>
                  <TH>Total</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((r) => {
                  const meta = statusMeta(r.status);
                  const busy = pendingId === r.id;
                  const terminal = r.status === "converted" || r.status === "declined";
                  return (
                    <TR key={r.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-dream-line bg-dream-bg">
                            {r.thumbnail && (
                              <Image
                                src={r.thumbnail}
                                alt=""
                                width={48}
                                height={48}
                                className="h-full w-full object-contain"
                              />
                            )}
                          </div>
                          <div className="text-xs text-dream-muted">
                            {r.designCount} {r.designCount === 1 ? "design" : "designs"}
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <div className="font-medium text-dream-ink">
                          {r.customerName ?? r.customerEmail ?? "—"}
                        </div>
                        <div className="text-xs text-dream-muted">{r.quoteNumber ?? r.customerEmail}</div>
                      </TD>
                      <TD className="max-w-[260px]">
                        <span className="line-clamp-2 text-sm text-dream-muted">{r.message ?? "—"}</span>
                      </TD>
                      <TD>
                        <Badge variant={meta.badge}>{meta.label}</Badge>
                      </TD>
                      <TD>
                        <span className="font-medium text-dream-ink">{formatCAD(r.total)}</span>
                      </TD>
                      <TD>
                        {r.status === "converted" && r.convertedOrderId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/orders/${r.convertedOrderId}`)}
                          >
                            View order
                          </Button>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {r.status === "requested" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={busy}
                                disabled={busy}
                                onClick={() => runStatus(r.id, "sent", "Marked sent")}
                              >
                                Mark sent
                              </Button>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              loading={busy}
                              disabled={busy || terminal}
                              onClick={() => runConvert(r.id)}
                            >
                              Convert to order
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              loading={busy}
                              disabled={busy || terminal}
                              onClick={() => runStatus(r.id, "declined", "Quote declined")}
                            >
                              Decline
                            </Button>
                          </div>
                        )}
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
