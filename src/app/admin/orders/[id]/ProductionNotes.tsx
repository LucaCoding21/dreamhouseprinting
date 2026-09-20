"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { updateProductionNotesAction } from "../actions";
import { LBL, useOrderAction } from "./shared";
import type { OrderRow, ProductionNotesJson } from "@/lib/db/rows";

export function ProductionNotes({
  order,
  canEdit,
}: {
  order: OrderRow;
  canEdit: boolean;
}) {
  const { pending, run } = useOrderAction();
  const stored = (order.production_notes ?? {}) as ProductionNotesJson;
  const initial = {
    customer: stored.customer ?? "",
    inventory: stored.inventory ?? "",
    printer: stored.printer ?? "",
  };
  const [notes, setNotes] = useState(initial);
  const [snap, setSnap] = useState(initial);
  const dirty = JSON.stringify(notes) !== JSON.stringify(snap);

  // Labels only, the stored keys never change (customer / inventory / printer).
  // "customer" is the one field the customer can read on their order page, so it
  // is labelled as theirs; the other two are staff-only.
  const fields: { key: keyof typeof initial; label: string; hint: string; internal?: boolean }[] = [
    { key: "customer", label: "Customer notes", hint: "What the customer asked for. Visible to the customer." },
    { key: "inventory", label: "My notes", hint: "Your own working notes on this job.", internal: true },
    { key: "printer", label: "Production notes", hint: "For whoever prints or presses it.", internal: true },
  ];

  function save() {
    run(
      () => updateProductionNotesAction(order.id, notes),
      "Notes saved",
      () => setSnap(notes),
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Notes</CardTitle>
        <Button variant="primary" size="sm" disabled={!canEdit || !dirty} loading={pending} onClick={save}>
          Save notes
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key}>
              <div className="mb-1 flex items-center gap-1.5">
                <span className={LBL}>{f.label}</span>
                {f.internal && (
                  <span className="rounded bg-dream-warn/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-dream-warn">
                    Internal
                  </span>
                )}
              </div>
              <p className="mb-1.5 text-xs text-dream-muted">{f.hint}</p>
              <Textarea
                rows={4}
                value={notes[f.key]}
                disabled={!canEdit}
                onChange={(e) => setNotes((n) => ({ ...n, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
