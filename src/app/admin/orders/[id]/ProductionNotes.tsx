"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
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

  const fields: { key: keyof typeof initial; label: string }[] = [
    { key: "customer", label: "Customer notes" },
    { key: "inventory", label: "Inventory notes" },
    { key: "printer", label: "Printer notes" },
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
        <CardTitle className="text-base">Production notes</CardTitle>
        <Button variant="primary" size="sm" disabled={!canEdit || !dirty} loading={pending} onClick={save}>
          Save notes
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key}>
              <div className={cn(LBL, "mb-1.5")}>{f.label}</div>
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
