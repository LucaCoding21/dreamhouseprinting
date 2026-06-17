"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { setOrderStatusAction } from "@/app/admin/orders/actions";
import type { OrderStatus } from "@/lib/db/rows";

export interface ProductionJob {
  id: string;
  orderNumber: string | null;
  status: string;
  dueDate: string | null;
  customerName: string | null;
  pieces: number;
  methodIds: string[];
}

/** A board column: the statuses it holds + the status a "Move →" advances a job to. */
interface Column {
  key: string;
  label: string;
  statuses: OrderStatus[];
  next: OrderStatus | null;
  nextLabel: string | null;
}

const COLUMNS: Column[] = [
  { key: "approved", label: "Art approved", statuses: ["approved"], next: "in_production", nextLabel: "Start printing" },
  { key: "printing", label: "Printing", statuses: ["in_production"], next: "quality_check", nextLabel: "To QC" },
  { key: "qc", label: "Quality check", statuses: ["quality_check"], next: "ready_for_pickup", nextLabel: "Mark ready" },
  { key: "done", label: "Ready / Shipped", statuses: ["ready_for_pickup", "shipped"], next: null, nextLabel: null },
];

function dueInfo(due: string | null): { label: string; overdue: boolean; soon: boolean } {
  if (!due) return { label: "No due date", overdue: false, soon: false };
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `${-days}d overdue`, overdue: true, soon: false };
  if (days === 0) return { label: "Due today", overdue: false, soon: true };
  return { label: `${days}d left`, overdue: false, soon: days <= 3 };
}

export function ProductionBoard({
  jobs,
  methodNames,
}: {
  jobs: ProductionJob[];
  methodNames: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);

  function move(jobId: string, next: OrderStatus) {
    setMovingId(jobId);
    start(async () => {
      const res = await setOrderStatusAction(jobId, next);
      setMovingId(null);
      if (res.error) {
        toast({ title: "Couldn’t move job", description: res.error, variant: "error" });
      } else {
        toast({ title: "Job moved", variant: "success" });
        router.refresh();
      }
    });
  }

  return (
    <div>
      <AdminHeader title="Production" />
      <div className="px-8 py-6">
        {jobs.length === 0 ? (
          <EmptyState
            title="Nothing in production"
            description="Approved orders show up here, ready to print, QC, and ship."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => {
              const colJobs = jobs.filter((j) => col.statuses.includes(j.status as OrderStatus));
              return (
                <div key={col.key} className="flex flex-col rounded-xl border border-dream-line bg-dream-bg/40">
                  <div className="flex items-center justify-between border-b border-dream-line px-4 py-3">
                    <h2 className="font-display text-sm font-bold text-dream-ink">{col.label}</h2>
                    <span className="rounded-full bg-dream-lavender-soft px-2 py-0.5 text-xs font-medium text-dream-purple">
                      {colJobs.length}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-3">
                    {colJobs.length === 0 ? (
                      <p className="px-1 py-6 text-center text-xs text-dream-muted">No jobs</p>
                    ) : (
                      colJobs.map((job) => {
                        const due = dueInfo(job.dueDate);
                        const methods = job.methodIds
                          .map((id) => methodNames[id])
                          .filter(Boolean) as string[];
                        const isMoving = pending && movingId === job.id;
                        return (
                          <div
                            key={job.id}
                            className="rounded-lg border border-dream-line bg-dream-surface p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/admin/orders/${job.id}`}
                                className="font-display text-sm font-bold text-dream-ink hover:text-dream-purple"
                              >
                                {job.orderNumber ?? "Order"}
                              </Link>
                              <Badge variant={due.overdue ? "danger" : due.soon ? "warn" : "neutral"}>
                                {due.label}
                              </Badge>
                            </div>
                            <div className="mt-1 truncate text-sm text-dream-muted">
                              {job.customerName ?? "—"}
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-dream-ink">{job.pieces} pcs</span>
                              {job.dueDate && (
                                <span className="text-xs text-dream-muted">{job.dueDate}</span>
                              )}
                            </div>
                            {methods.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {methods.map((m) => (
                                  <span
                                    key={m}
                                    className="rounded bg-dream-bg px-2 py-0.5 text-xs text-dream-ink"
                                  >
                                    {m}
                                  </span>
                                ))}
                              </div>
                            )}
                            {col.next && col.nextLabel && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className={cn("mt-3 w-full")}
                                loading={isMoving}
                                disabled={pending}
                                onClick={() => move(job.id, col.next as OrderStatus)}
                              >
                                {col.nextLabel} →
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
