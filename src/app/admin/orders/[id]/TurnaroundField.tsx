"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  MAX_TURNAROUND_DAYS,
  fmtDaysRange,
  fmtReadyDay,
  readyByFor,
  resolveTurnaround,
  type StandardWindow,
} from "@/lib/orders/turnaround";
import type { OrderRow } from "@/lib/db/rows";
import { setTurnaroundAction } from "../actions";
import { LBL, useOrderAction } from "./shared";

/**
 * Julian's "In hands" control. Two ways an order's ready date can be decided:
 *
 *  - Business days: N-M business days counted from the moment the customer has
 *    approved AND paid (the standard 8-12, or a rush tier's count). Until then
 *    there is no date, because a customer who sits on the proof pushes their
 *    own date back. Once the count starts, the dates appear here.
 *  - Fixed date: a date Julian commits to (an event, a confirmed rush).
 *
 * The customer's order page shows the same rule (lib/orders/turnaround.ts).
 */
export function TurnaroundField({
  order,
  standard,
  canEdit,
}: {
  order: OrderRow;
  standard: StandardWindow;
  canEdit: boolean;
}) {
  const { pending, run } = useOrderAction();
  const t = resolveTurnaround(order.turnaround ?? null, order.due_date, standard);
  const ready = readyByFor(order, standard);
  const clockAt = order.production_clock_at ?? null;

  // The segmented pick only diverges from the saved mode while Julian is
  // choosing a fixed date he hasn't picked yet.
  const [mode, setMode] = useState<"days" | "date">(t.kind);
  const shownMode = t.kind === "date" ? "date" : mode;
  const savedMin = t.kind === "days" ? t.min : standard.min;
  const savedMax = t.kind === "days" ? t.max : standard.max;
  const [draft, setDraft] = useState<{ base: string; min: string; max: string } | null>(null);
  const base = `${savedMin}-${savedMax}`;
  const minVal = draft && draft.base === base ? draft.min : String(savedMin);
  const maxVal = draft && draft.base === base ? draft.max : String(savedMax);
  const dirty = minVal !== String(savedMin) || maxVal !== String(savedMax);

  function saveDays(min: number, max: number) {
    run(() => setTurnaroundAction(order.id, { kind: "days", min, max }), "Turnaround saved", () => setDraft(null));
  }

  function pickDays() {
    setMode("days");
    // Leaving a fixed date: back to business days in one click.
    if (t.kind === "date") saveDays(standard.min, standard.max);
  }

  const numInput =
    "h-9 w-14 rounded-lg border border-dream-line bg-white px-2 text-center text-base font-semibold tabular-nums text-dream-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple disabled:opacity-60 sm:text-sm";

  const status =
    ready?.state === "running" ? (
      ready.from && ready.to ? (
        <>
          Counting since {fmtReadyDay(ready.startedOn!)}.{" "}
          <span className="font-semibold text-dream-ink">
            Ready {ready.min === ready.max ? `by ${fmtReadyDay(ready.to)}` : `${fmtReadyDay(ready.from)} to ${fmtReadyDay(ready.to)}`}
          </span>
        </>
      ) : (
        "Counting (start date not recorded)."
      )
    ) : ready?.state === "waiting" ? (
      "No date yet. The count starts when the customer has approved and paid."
    ) : ready?.state === "date" && ready.requested ? (
      "The customer asked for this date. Picking a date confirms it."
    ) : !ready && t.kind === "days" && clockAt ? (
      "Order finished."
    ) : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className={LBL}>In hands</div>
        {canEdit && (
          <div className="inline-flex rounded-lg border border-dream-line bg-dream-bg p-0.5 text-xs font-semibold" role="group" aria-label="How the ready date is set">
            {(
              [
                ["days", "Business days"],
                ["date", "Fixed date"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                disabled={pending}
                aria-pressed={shownMode === key}
                onClick={() => (key === "days" ? pickDays() : setMode("date"))}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  shownMode === key ? "bg-white text-dream-ink shadow-sm" : "text-dream-muted hover:text-dream-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {shownMode === "date" ? (
        canEdit ? (
          <input
            type="date"
            value={t.kind === "date" ? (order.due_date ?? "") : ""}
            disabled={pending}
            title="The in-hands date for this order. Picking one saves it."
            onChange={(e) => {
              const next = e.target.value;
              if (next) run(() => setTurnaroundAction(order.id, { kind: "date", date: next }), "In-hands date saved");
            }}
            // 16px text below sm or iOS Safari zooms the page on focus.
            className="mt-1.5 h-9 w-full rounded-lg border border-dream-line bg-white px-2 text-base font-semibold text-dream-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple sm:text-sm"
          />
        ) : (
          <div className="mt-0.5 text-sm font-semibold text-dream-ink">
            {order.due_date ? fmtReadyDay(order.due_date) : "-"}
          </div>
        )
      ) : canEdit ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-dream-muted">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_TURNAROUND_DAYS}
            value={minVal}
            disabled={pending}
            aria-label="Fewest business days"
            onChange={(e) => setDraft({ base, min: e.target.value, max: maxVal })}
            className={numInput}
          />
          <span>to</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_TURNAROUND_DAYS}
            value={maxVal}
            disabled={pending}
            aria-label="Most business days"
            onChange={(e) => setDraft({ base, min: minVal, max: e.target.value })}
            className={numInput}
          />
          <span>business days</span>
          {dirty && (
            <Button size="sm" variant="secondary" loading={pending} onClick={() => saveDays(Number(minVal), Number(maxVal))}>
              Save
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-0.5 text-sm font-semibold text-dream-ink">{t.kind === "days" ? fmtDaysRange(t) : "-"}</div>
      )}

      {shownMode === "days" && <p className="mt-1 text-xs text-dream-faint">After approval and payment.</p>}
      {status && <p className="mt-1.5 text-xs leading-snug text-dream-muted">{status}</p>}
    </div>
  );
}
