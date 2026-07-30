"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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
  const hasAdvanced = spot.puff || spot.spotProcess || !!extraSpecActive;
  const [showAdvanced, setShowAdvanced] = useState(hasAdvanced);

  // Typing a spec is Width, Height, Colours, in that order. The "?" help dots
  // and the Pantone buttons sit between those inputs in the DOM, so the jump is
  // wired explicitly and everything in between is mouse-only (tabIndex -1).
  const widthRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const coloursRef = useRef<HTMLInputElement>(null);

  function tabTo(e: KeyboardEvent<HTMLInputElement>, forward: HTMLInputElement | null, back: HTMLInputElement | null) {
    if (e.key !== "Tab") return;
    const target = e.shiftKey ? back : forward;
    if (!target) return;
    e.preventDefault();
    target.focus();
    target.select();
  }

  /** Colour counts are 1 to 8 screens/threads; words like "Full colour" step from 1. */
  const stepColours = (delta: number) => {
    const n = parseInt(spot.colours.replace(/^~/, ""), 10);
    const from = Number.isFinite(n) && n > 0 ? n : delta > 0 ? 0 : 2;
    onPatch({ colours: String(Math.min(8, Math.max(1, from + delta))) });
  };
  const colourCount = parseInt(spot.colours.replace(/^~/, ""), 10);
  const numericColours = Number.isFinite(colourCount) ? colourCount : null;

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
        {/* Measurements are inches to 3 decimals at most (e.g. 14.325), so the
            boxes are sized for about seven characters, not a full-width field. */}
        <div className="w-[4.75rem]">
          <div className={cn(LBL, "mb-1 flex items-center gap-1")}>
            Width
            <MeasureHelpDot />
          </div>
          <div className="flex items-center gap-1">
            <Input
              ref={widthRef}
              value={spot.widthIn}
              inputMode="decimal"
              maxLength={7}
              disabled={!canEdit}
              onChange={(e) => onPatch({ widthIn: e.target.value })}
              onKeyDown={(e) => tabTo(e, heightRef.current, null)}
              className="min-w-0 flex-1 px-1.5 text-center"
            />
            <span className="text-xs text-dream-muted">in</span>
          </div>
        </div>
        <div className="w-[4.75rem]">
          <div className={cn(LBL, "mb-1 flex items-center gap-1")}>
            Height
            <MeasureHelpDot />
          </div>
          <div className="flex items-center gap-1">
            <Input
              ref={heightRef}
              value={spot.heightIn}
              inputMode="decimal"
              maxLength={7}
              disabled={!canEdit}
              onChange={(e) => onPatch({ heightIn: e.target.value })}
              onKeyDown={(e) => tabTo(e, coloursRef.current, widthRef.current)}
              className="min-w-0 flex-1 px-1.5 text-center"
            />
            <span className="text-xs text-dream-muted">in</span>
          </div>
        </div>
        <div className="w-[5.75rem]">
          <div className={cn(LBL, "mb-1")}># Colours</div>
          {/* A count, so two characters is the ceiling. The designer can also
              pre-fill a word ("Full colour"), which stays editable in full. The
              steppers are for the common case: nudging 1 to 8 without typing. */}
          <div className="flex items-center gap-1">
            <Input
              ref={coloursRef}
              value={spot.colours}
              inputMode="numeric"
              maxLength={/^~?\d*$/.test(spot.colours) ? 3 : undefined}
              title={spot.colours || undefined}
              disabled={!canEdit}
              onChange={(e) => onPatch({ colours: e.target.value })}
              onKeyDown={(e) => tabTo(e, null, heightRef.current)}
              className="min-w-0 flex-1 px-1.5 text-center"
            />
            {canEdit && (
              <span className="flex shrink-0 flex-col">
                <ColourStep dir="up" disabled={numericColours !== null && numericColours >= 8} onClick={() => stepColours(1)} />
                <ColourStep dir="down" disabled={numericColours !== null && numericColours <= 1} onClick={() => stepColours(-1)} />
              </span>
            )}
          </div>
        </div>
        {/* Pantones live on the main row (used constantly), not in Advanced spec. */}
        <div className="max-w-md">
          <div className={cn(LBL, "mb-1")}>Pantones</div>
          <div className="flex min-h-10 flex-wrap items-center gap-1.5">
            {spot.pantones.map((code, pi) => (
              <span key={pi} className="flex items-center gap-0.5">
                <Input
                  value={code}
                  disabled={!canEdit}
                  placeholder="e.g. 7676 C"
                  onChange={(e) => onPatch({ pantones: spot.pantones.map((c, i) => (i === pi ? e.target.value : c)) })}
                  className="h-9 w-24 px-1.5 text-sm"
                />
                {canEdit && (
                  <button
                    type="button"
                    aria-label="Remove Pantone colour"
                    // Mouse-only, so Tab runs Width, Height, Colours.
                    tabIndex={-1}
                    className="px-0.5 text-dream-faint hover:text-dream-danger"
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
                tabIndex={-1}
                className="whitespace-nowrap text-sm text-dream-purple hover:underline"
                onClick={() => onPatch({ pantones: [...spot.pantones, ""] })}
              >
                + Pantone
              </button>
            )}
            {!canEdit && spot.pantones.length === 0 && <span className="text-xs italic text-dream-faint">-</span>}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            aria-label={`Remove decoration ${index + 1}`}
            tabIndex={-1}
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
          </div>
        )}
      </div>
    </div>
  );
}

/** Half-height chevron button, stacked into a compact spinner beside # Colours. */
function ColourStep({
  dir,
  disabled,
  onClick,
}: {
  dir: "up" | "down";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      tabIndex={-1}
      aria-label={dir === "up" ? "One more colour" : "One less colour"}
      title={dir === "up" ? "One more colour" : "One less colour"}
      onClick={onClick}
      className={cn(
        "flex h-[18px] w-5 items-center justify-center border border-dream-line bg-white text-dream-muted transition-colors",
        dir === "up" ? "rounded-t-md" : "-mt-px rounded-b-md",
        disabled ? "cursor-not-allowed opacity-40" : "hover:border-dream-purple hover:text-dream-purple",
      )}
    >
      <svg viewBox="0 0 16 16" fill="none" className={cn("h-3 w-3", dir === "down" && "rotate-180")} aria-hidden>
        <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
