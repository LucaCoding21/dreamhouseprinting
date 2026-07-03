"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { addOrderNoteAction } from "../actions";
import { fmtWhen, useOrderAction, type Note } from "./shared";
import type { OrderRow } from "@/lib/db/rows";

export function OrderTimeline({
  order,
  orderId,
  canEdit,
}: {
  order: OrderRow;
  orderId: string;
  canEdit: boolean;
}) {
  const { pending, run } = useOrderAction();
  const [note, setNote] = useState("");
  const [vis, setVis] = useState<"internal" | "customer">("internal");

  const feed = useMemo(() => {
    const internal = ((order.internal_notes ?? []) as unknown as Note[]).map((n) => ({ ...n, vis: "internal" as const }));
    const customer = ((order.customer_notes ?? []) as unknown as Note[]).map((n) => ({ ...n, vis: "customer" as const }));
    return [...internal, ...customer].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [order.internal_notes, order.customer_notes]);

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        {feed.length === 0 && (
          <p className="text-sm text-dream-muted">No comments yet. Notes about this job show up here, newest first.</p>
        )}

        {feed.map((n, i) => {
          const internal = n.vis === "internal";
          return (
            <div
              key={`${n.at}-${i}`}
              className={cn(
                "rounded-lg border px-4 py-3",
                internal ? "border-dream-warn/30 bg-dream-warn-soft" : "border-dream-line bg-white",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-dream-ink">
                  {n.actor}
                  <span className="ml-1 font-normal text-dream-muted">@ {fmtWhen(n.at)}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    internal ? "bg-dream-warn/15 text-dream-warn" : "bg-dream-info-soft text-dream-info",
                  )}
                >
                  {internal ? "Admin" : "Customer-visible"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-dream-ink">{n.text}</p>
            </div>
          );
        })}

        <div className="flex flex-wrap items-start gap-2 border-t border-dream-line pt-3">
          <Textarea
            rows={1}
            placeholder="Add a comment…"
            value={note}
            disabled={!canEdit}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-10 flex-1 basis-64"
          />
          <Select
            value={vis}
            disabled={!canEdit}
            onChange={(e) => setVis(e.target.value as "internal" | "customer")}
            className="w-44"
          >
            <option value="internal">Internal (admin only)</option>
            <option value="customer">Customer-visible</option>
          </Select>
          <Button
            variant="primary"
            loading={pending}
            disabled={!canEdit || !note.trim()}
            onClick={() =>
              run(
                async () => {
                  const r = await addOrderNoteAction(orderId, note, vis);
                  if (!r.error) setNote("");
                  return r;
                },
                "Comment added",
              )
            }
          >
            Add comment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
