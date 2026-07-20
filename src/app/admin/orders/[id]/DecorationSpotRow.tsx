"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/cn";
import { LBL } from "./shared";
import { MeasureHelpDot } from "./MeasureHelp";
import type { DecorationSpot } from "../actions";

export function DecorationSpotRow({
  spot,
  index,
  methodOptions,
  canEdit,
  onPatch,
  onRemove,
  extraSpec,
  extraSpecActive,
}: {
  spot: DecorationSpot;
  index: number;
  methodOptions: string[];
  canEdit: boolean;
  onPatch: (patch: Partial<DecorationSpot>) => void;
  onRemove: () => void;
  /** Extra line-level finishing controls rendered inside the Advanced spec area (first spot only). */
  extraSpec?: ReactNode;
  /** Whether any extraSpec option is set, factors into auto-open + the "has advanced" dot. */
  extraSpecActive?: boolean;
}) {
  const hasAdvanced = spot.pantones.length > 0 || spot.puff || spot.spotProcess || !!extraSpecActive;
  const [showAdvanced, setShowAdvanced] = useState(hasAdvanced);

  return (
    <div className="space-y-3 rounded-lg border border-dream-line p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <div className={cn(LBL, "mb-1")}>Location</div>
          <Input value={spot.location} disabled={!canEdit} onChange={(e) => onPatch({ location: e.target.value })} />
        </div>
        <div className="w-40">
          <div className={cn(LBL, "mb-1")}>Type</div>
          <Select value={spot.type} disabled={!canEdit} onChange={(e) => onPatch({ type: e.target.value })}>
            <option value="">-</option>
            {methodOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {spot.type && !methodOptions.includes(spot.type) && <option value={spot.type}>{spot.type}</option>}
          </Select>
        </div>
        <div className="w-24">
          <div className={cn(LBL, "mb-1 flex items-center gap-1")}>
            Width
            <MeasureHelpDot />
          </div>
          <div className="flex items-center gap-1">
            <Input value={spot.widthIn} disabled={!canEdit} onChange={(e) => onPatch({ widthIn: e.target.value })} />
            <span className="text-xs text-dream-muted">in</span>
          </div>
        </div>
        <div className="w-24">
          <div className={cn(LBL, "mb-1 flex items-center gap-1")}>
            Height
            <MeasureHelpDot />
          </div>
          <div className="flex items-center gap-1">
            <Input value={spot.heightIn} disabled={!canEdit} onChange={(e) => onPatch({ heightIn: e.target.value })} />
            <span className="text-xs text-dream-muted">in</span>
          </div>
        </div>
        <div className="w-24">
          <div className={cn(LBL, "mb-1")}># Colours</div>
          <Input value={spot.colours} disabled={!canEdit} onChange={(e) => onPatch({ colours: e.target.value })} />
        </div>
        {canEdit && (
          <button
            type="button"
            aria-label={`Remove decoration ${index + 1}`}
            className="mb-2 ml-auto rounded p-1 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
            onClick={onRemove}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dream-muted transition-colors hover:text-dream-ink"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-90")}
            aria-hidden
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Advanced spec
          {!showAdvanced && hasAdvanced && <span className="h-1.5 w-1.5 rounded-full bg-dream-purple" aria-hidden />}
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-4 border-t border-dream-line pt-3">
            <div className="flex flex-col gap-1.5">
              <div className={LBL}>Spec</div>
              <Checkbox label="Puff" checked={spot.puff} disabled={!canEdit} onChange={(e) => onPatch({ puff: e.target.checked })} />
              <Checkbox
                label="Spot process"
                checked={spot.spotProcess}
                disabled={!canEdit}
                onChange={(e) => onPatch({ spotProcess: e.target.checked })}
              />
            </div>

            {extraSpec}

            <div>
              <div className={cn(LBL, "mb-1.5")}>Pantone colours</div>
              {spot.pantones.length === 0 && <p className="text-xs italic text-dream-faint">No colours yet</p>}
              <div className="flex flex-col items-start gap-2">
                {spot.pantones.map((code, pi) => (
                  <span key={pi} className="flex items-center gap-1">
                    <Input
                      value={code}
                      disabled={!canEdit}
                      placeholder="Pantone code"
                      onChange={(e) => onPatch({ pantones: spot.pantones.map((c, i) => (i === pi ? e.target.value : c)) })}
                      className="h-8 w-40 text-sm"
                    />
                    {canEdit && (
                      <button
                        type="button"
                        aria-label="Remove colour"
                        className="text-dream-faint hover:text-dream-danger"
                        onClick={() => onPatch({ pantones: spot.pantones.filter((_, i) => i !== pi) })}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {canEdit && (
                  <button
                    type="button"
                    className="text-sm text-dream-purple hover:underline"
                    onClick={() => onPatch({ pantones: [...spot.pantones, ""] })}
                  >
                    + Add colour
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
