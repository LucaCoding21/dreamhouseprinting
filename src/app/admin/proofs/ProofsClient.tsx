"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/rows";

export interface ProofQueueRow {
  id: string;
  orderNumber: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  mockups: string[];
  sourceArt: { name: string; url: string }[];
  changeRequest: string | null;
}

const TABS: { key: string; label: string; match: (s: string) => boolean }[] = [
  { key: "needs_proof", label: "Needs proof", match: (s) => s === "submitted" || s === "in_review" },
  { key: "awaiting", label: "Awaiting customer", match: (s) => s === "proof_ready" },
  { key: "changes", label: "Changes requested", match: (s) => s === "changes_requested" },
];

function inHands(due: string | null): { label: string; urgent: boolean } {
  if (!due) return { label: "No due date", urgent: false };
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `${-days}d overdue`, urgent: true };
  if (days === 0) return { label: "Due today", urgent: true };
  return { label: `${days}d left`, urgent: days <= 3 };
}

export function ProofsClient({ rows }: { rows: ProofQueueRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState("needs_proof");

  const count = (m: (s: string) => boolean) => rows.filter((r) => m(r.status)).length;
  const visible = rows.filter((r) => TABS.find((t) => t.key === tab)!.match(r.status));

  return (
    <div>
      <AdminHeader title="Proofs & Artwork" />
      <div className="px-8 py-6">
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
                  : "border-transparent text-dream-muted hover:text-dream-ink",
              )}
            >
              {t.label} <span className="text-dream-faint">{count(t.match)}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Nothing in this queue"
            description="Submissions land here when they need a proof, are awaiting customer approval, or have changes requested."
          />
        ) : (
          <div className="space-y-3">
            {visible.map((r) => {
              const meta = STATUS_META[r.status as OrderStatus];
              const ih = inHands(r.dueDate);
              return (
                <button
                  key={r.id}
                  onClick={() => router.push(`/admin/orders/${r.id}`)}
                  className="flex w-full gap-4 rounded-xl border border-dream-line bg-dream-surface p-4 text-left transition-colors hover:border-dream-purple"
                >
                  {/* Mockup thumbnail */}
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-dream-line bg-dream-bg">
                    {r.mockups[0] ? (
                      <Image
                        src={r.mockups[0]}
                        alt=""
                        width={96}
                        height={96}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-dream-faint">
                        No mockup
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-semibold text-dream-ink">
                        {r.orderNumber ?? "Order"}
                      </span>
                      <Badge variant={meta?.badge ?? "neutral"}>{meta?.label ?? r.status}</Badge>
                      <span className={cn("text-xs", ih.urgent ? "text-dream-danger" : "text-dream-muted")}>
                        {ih.label}
                      </span>
                    </div>

                    <div className="mt-0.5 text-sm text-dream-muted">
                      {r.customerName ?? r.customerEmail ?? "—"}
                    </div>

                    {r.changeRequest && (
                      <p className="mt-2 rounded-lg bg-dream-warn-soft px-3 py-1.5 text-sm text-dream-warn">
                        “{r.changeRequest}”
                      </p>
                    )}

                    {r.sourceArt.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-dream-muted">
                          Artwork
                        </span>
                        {r.sourceArt.map((a, i) => (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm text-dream-purple underline"
                          >
                            {a.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Extra mockup thumbs */}
                  {r.mockups.length > 1 && (
                    <div className="hidden shrink-0 items-start gap-1.5 sm:flex">
                      {r.mockups.slice(1, 4).map((m, i) => (
                        <div
                          key={i}
                          className="h-12 w-12 overflow-hidden rounded border border-dream-line bg-dream-bg"
                        >
                          <Image src={m} alt="" width={48} height={48} className="h-full w-full object-contain" />
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
