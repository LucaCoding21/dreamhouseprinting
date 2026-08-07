"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { rushTierFee, type RushTier } from "@/lib/pricing/decorationPricing";
import { RushDatePicker } from "@/components/RushDatePicker";

/** Which rush ask the customer made: nothing, a target date, or a priced tier. */
export type RushMode = "none" | "date" | "sooner";

export interface RushRequestValue {
  mode: RushMode;
  /** Requested in-hand date (YYYY-MM-DD), only meaningful when mode is "date". */
  date: string | null;
  /** Chosen tier id, only meaningful when mode is "sooner". */
  tierId: string | null;
}

export const EMPTY_RUSH: RushRequestValue = { mode: "none", date: null, tierId: null };

/**
 * Resolve a rush selection to the tier it points at. Returns null for a date
 * request (no automatic fee, our team quotes it) or no rush at all, so callers
 * can treat "no tier" as "nothing to charge".
 */
export function resolveRushTier(value: RushRequestValue, tiers: RushTier[]): RushTier | null {
  if (value.mode !== "sooner") return null;
  return tiers.find((t) => t.id === value.tierId) ?? null;
}

/**
 * "Request a rush", ONE box with two mutually exclusive asks: a target date
 * (no automatic fee, we confirm and quote it) or one of the priced "sooner"
 * tiers, whose fee joins the estimate.
 *
 * This lives at checkout, not in the designer: rush is a property of the whole
 * order being placed, not of an individual design, so a customer submitting two
 * designs picks one deadline for the lot.
 */
export function RushRequest({
  value,
  onChange,
  tiers,
  standardDays,
  subtotal,
  setupTotal,
  className,
}: {
  value: RushRequestValue;
  onChange: (v: RushRequestValue) => void;
  tiers: RushTier[];
  /** Normal turnaround in business days, shown next to the priced tiers. */
  standardDays: number;
  /** Pre-tax goods subtotal the percentage fees are quoted against. */
  subtotal: number;
  setupTotal: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-dream-line bg-white px-5 py-5", className)}>
      <h3 className="font-display text-lg font-bold leading-tight text-dream-ink">Request a rush</h3>
      <p className="mt-1 text-sm leading-relaxed text-dream-muted">
        We&apos;ll do our best to accommodate requested rushes.
      </p>
      <div className="mt-4 space-y-2.5">
        <RushChoice
          title="Pick a date"
          selected={value.mode === "date"}
          onSelect={() =>
            onChange(
              value.mode === "date" ? EMPTY_RUSH : { mode: "date", date: value.date, tierId: null },
            )
          }
        >
          <RushDatePicker
            className="mt-3"
            value={value.date}
            onChange={(date) => onChange({ mode: "date", date, tierId: null })}
          />
          <p className="mt-2 text-xs leading-relaxed text-dream-muted">
            Our team will confirm the timeline and quote any rush fee.
          </p>
        </RushChoice>

        {/* Priced options only exist when Julian has rush tiers configured; with
            none, the date request is the whole box. */}
        {tiers.length > 0 && (
          <RushChoice
            title="I just want it sooner"
            selected={value.mode === "sooner"}
            onSelect={() =>
              onChange(
                value.mode === "sooner"
                  ? EMPTY_RUSH
                  : { mode: "sooner", date: null, tierId: value.tierId },
              )
            }
          >
            <>
              <div className="mt-3 space-y-2">
                {tiers.map((t) => {
                  const on = value.tierId === t.id;
                  const fee = rushTierFee(subtotal, setupTotal, t.pct);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        onChange({ mode: "sooner", date: null, tierId: on ? null : t.id })
                      }
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                        on
                          ? "border-dream-purple bg-dream-lavender-mist"
                          : "border-dream-line bg-white hover:border-dream-purple/50",
                      )}
                    >
                      <span className="font-display text-sm font-bold text-dream-ink">
                        {t.days} business days
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-semibold text-dream-muted">+{t.pct}%</span>
                        <span className="rounded-full bg-dream-sun px-2.5 py-0.5 font-display text-xs font-extrabold text-dream-ink">
                          +{formatCAD(fee)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-dream-muted">
                Standard: {standardDays} business days.
              </p>
            </>
          </RushChoice>
        )}
      </div>
    </div>
  );
}

/** One of the two mutually exclusive rush asks. Selecting it reveals its own
 *  controls; selecting the other (or clicking it again) closes it. */
function RushChoice({
  title,
  selected,
  onSelect,
  children,
}: {
  title: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    // The WHOLE container toggles the choice, not just the radio row. The
    // header button stays for keyboard users (its Enter/Space click bubbles
    // up to this div's handler, so there is exactly one toggle path).
    <div
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-xl border px-4 py-3.5 transition-colors",
        selected
          ? "border-dream-purple bg-dream-lavender-mist/50"
          : "border-dream-line bg-white hover:border-dream-purple/50",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        className="flex w-full cursor-pointer items-center gap-3 text-left"
      >
        <span
          aria-hidden
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
            selected ? "border-dream-purple" : "border-dream-line-strong",
          )}
        >
          {selected && <span className="h-2.5 w-2.5 rounded-full bg-dream-purple" />}
        </span>
        <span className="font-display text-sm font-bold text-dream-ink">{title}</span>
      </button>
      {selected && (
        // Clicks on the revealed controls (date picker, tier rows) must not
        // bubble up and collapse the box they live in.
        <div className="cursor-default" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}
