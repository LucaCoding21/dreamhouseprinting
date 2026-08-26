"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { priceFromCurveForPrints, MAX_LOCATIONS } from "@/lib/pricing/quote";
import type { ProductQuoteCurveJson, QuoteDecoration } from "@/lib/db/rows";

const DECO_LABEL: Record<QuoteDecoration, string> = {
  screen: "Screen print",
  embroidery: "Embroidery",
};

const QTY_MIN = 1;
const QTY_MAX = 1000;
const DEFAULT_QTY = 25;
const PRESETS = [10, 25, 50, 100, 250];

/**
 * Interactive "Detailed Quote" on the product page (replaces the old static
 * Estimated total card). Customers pick decoration / ink colours / locations and
 * set quantity to watch the per-unit price drop, mirroring the quick-quote curve
 * in lib/pricing.ts (via priceFromCurve). One scannable column: choices up top,
 * a grounded price summary, then the CTA.
 */
export function DetailedQuote({
  curve,
  productId,
  colourName,
  allowedDecorations,
}: {
  curve: ProductQuoteCurveJson;
  productId: string;
  /** Currently selected colour name, carried into the designer link. */
  colourName?: string;
  /** Decorations the admin enabled for this product; omit to offer the full curve. */
  allowedDecorations?: QuoteDecoration[];
}) {
  const designHref = colourName
    ? `/design/${productId}?colour=${encodeURIComponent(colourName)}`
    : `/design/${productId}`;
  const quoteHref = colourName
    ? `/design/${productId}?quote=1&colour=${encodeURIComponent(colourName)}`
    : `/design/${productId}?quote=1`;
  // Offer the curve's decorations, narrowed to the admin-enabled ones. An empty
  // intersection falls back to the full curve so the widget can always quote.
  const decorations = useMemo(() => {
    const base = curve.decorations.length ? curve.decorations : (["screen"] as QuoteDecoration[]);
    if (!allowedDecorations?.length) return base;
    const offered = base.filter((d) => allowedDecorations.includes(d));
    return offered.length ? offered : base;
  }, [curve.decorations, allowedDecorations]);
  const [decoration, setDecoration] = useState<QuoteDecoration>(decorations[0]);
  // One entry per print, each with its own colour count: Julian charges every
  // print separately, so a 3-colour front and a 2-colour back pays for both.
  // This used to be a single colour count plus a location count, which
  // under-quoted exactly those multi-print jobs.
  const [prints, setPrints] = useState<{ id: number; colours: number }[]>([{ id: 0, colours: 1 }]);
  const printSeq = useRef(1);
  const [qty, setQty] = useState(DEFAULT_QTY);
  // Raw text of the number field, so partial edits (clearing, typing "2" then
  // "50") don't get clamped mid-keystroke. qty stays the source of truth.
  const [qtyText, setQtyText] = useState(String(DEFAULT_QTY));
  // The estimate starts collapsed: "Design Now" is the primary path, and the
  // estimate is an opt-in secondary so the two CTAs don't compete for attention.
  const [estimateOpen, setEstimateOpen] = useState(false);

  const isScreen = decoration === "screen";
  const isPresetQty = PRESETS.includes(qty);

  const result = useMemo(
    () => priceFromCurveForPrints(curve, { qty: Math.max(qty, 1), prints, decoration }),
    [curve, qty, prints, decoration],
  );

  // Collapsed-header teaser: the simplest job (one 1-colour print) at 50 pieces,
  // so the closed card already shows a real number instead of ad copy.
  const teaser = useMemo(
    () =>
      priceFromCurveForPrints(curve, {
        qty: 50,
        prints: [{ colours: 1 }],
        decoration: decorations[0],
      }),
    [curve, decorations],
  );

  const addPrint = () =>
    setPrints((p) => (p.length >= MAX_LOCATIONS ? p : [...p, { id: printSeq.current++, colours: 1 }]));
  const removePrint = (id: number) => setPrints((p) => (p.length <= 1 ? p : p.filter((r) => r.id !== id)));
  const setPrintColours = (id: number, n: number) =>
    setPrints((p) => p.map((r) => (r.id === id ? { ...r, colours: n } : r)));

  // Slider + preset chips set the quantity directly and mirror it into the field.
  function setQtyFromControl(raw: number) {
    const clamped = Math.min(QTY_MAX, Math.max(QTY_MIN, Math.round(raw)));
    setQty(clamped);
    setQtyText(String(clamped));
  }

  // Number field: keep the live text, only update qty when it's a valid in-range
  // number; defer clamping until the field is committed (blur / Enter).
  function onQtyTextChange(value: string) {
    setQtyText(value);
    const n = Number(value);
    if (value.trim() !== "" && Number.isFinite(n) && n >= QTY_MIN && n <= QTY_MAX) {
      setQty(Math.round(n));
    }
  }

  function commitQtyText() {
    const n = Number(qtyText);
    const clamped = Number.isFinite(n)
      ? Math.min(QTY_MAX, Math.max(QTY_MIN, Math.round(n)))
      : QTY_MIN;
    setQty(clamped);
    setQtyText(String(clamped));
  }

  return (
    <div className="-mt-3 flex flex-col gap-3">
      <Link
        href={designHref}
        className="rough-pill rough-pill-filled inline-flex items-center justify-center px-7 py-3.5 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
      >
        Design Now
      </Link>

      {/* OR divider between the primary CTA and the opt-in estimate */}
      <div className="flex items-center gap-4 py-1.5" aria-hidden="true">
        <span className="h-px flex-1 rounded-full bg-dream-line" />
        <span className="font-display text-sm font-semibold lowercase italic text-dream-muted">
          or
        </span>
        <span className="h-px flex-1 rounded-full bg-dream-line" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-dream-line bg-dream-surface">
      {/* Toggle: expands the estimate builder below. Collapsed by default. */}
      <button
        type="button"
        aria-expanded={estimateOpen}
        aria-controls="instant-estimate-panel"
        onClick={() => setEstimateOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-dream-lavender-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dream-purple/40"
      >
        <span className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-6 w-6 shrink-0 text-dream-purple"
          >
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="8" y1="6" x2="16" y2="6" />
            <line x1="8" y1="10" x2="8" y2="10" />
            <line x1="12" y1="10" x2="12" y2="10" />
            <line x1="16" y1="10" x2="16" y2="10" />
            <line x1="8" y1="14" x2="8" y2="14" />
            <line x1="12" y1="14" x2="12" y2="14" />
            <line x1="16" y1="14" x2="16" y2="18" />
            <line x1="8" y1="18" x2="12" y2="18" />
          </svg>
          <span>
            <span className="block font-display text-xl font-bold text-dream-ink">
              Instant quote
            </span>
            <span className="mt-0.5 block text-[14px] text-dream-muted">
              From {formatCAD(teaser.perUnit)}/unit at 50 pieces
            </span>
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn(
            "h-5 w-5 shrink-0 text-dream-purple transition-transform duration-300",
            estimateOpen && "rotate-180",
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        id="instant-estimate-panel"
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          estimateOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
      <div className="overflow-hidden">
      <div className="flex flex-col gap-5 border-t border-dream-line p-5">
      {/* Decoration, a picker when the product offers a choice, otherwise a
          static label so customers still see the technique this product gets */}
      <Row label="Decoration">
        {decorations.length > 1 ? (
          <div className="flex gap-1.5 rounded-full bg-dream-bg p-1">
            {decorations.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDecoration(d)}
                aria-pressed={d === decoration}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                  d === decoration
                    ? "bg-dream-ink text-white shadow-sm"
                    : "text-dream-ink-soft hover:text-dream-ink",
                )}
              >
                {DECO_LABEL[d]}
              </button>
            ))}
          </div>
        ) : (
          <span className="inline-flex items-center rounded-full bg-dream-bg px-4 py-1.5 text-sm font-semibold text-dream-ink">
            {DECO_LABEL[decoration]}
          </span>
        )}
      </Row>

      {/* Prints: one row per print. Each carries its own ink colours, because
          each is charged on its own. Embroidery rows show no colour picker,
          thread colours are free. */}
      <Row label={prints.length === 1 ? "Your print" : `Your prints (${prints.length})`}>
        <div className="space-y-2">
          {prints.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5">
              <span className="w-7 shrink-0 text-[14px] font-semibold tabular-nums text-dream-ink-soft">
                {i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`}
              </span>
              {isScreen ? (
                <div className="min-w-0 flex-1">
                  <Chips
                    values={[1, 2, 3, 4]}
                    selected={p.colours}
                    onSelect={(n) => setPrintColours(p.id, n)}
                  />
                </div>
              ) : (
                <span className="min-w-0 flex-1 text-sm text-dream-muted">Any thread colours</span>
              )}
              <button
                type="button"
                onClick={() => removePrint(p.id)}
                disabled={prints.length <= 1}
                aria-label={`Remove print ${i + 1}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-dream-faint transition-colors hover:bg-dream-bg hover:text-dream-ink disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
          {isScreen && <p className="text-[14px] text-dream-muted">Ink colours in each print.</p>}
          {prints.length < MAX_LOCATIONS && (
            <button
              type="button"
              onClick={addPrint}
              className="text-[14px] font-semibold text-dream-purple hover:underline"
            >
              + Add another print
            </button>
          )}
        </div>
      </Row>

      {/* Quantity: quick-pick presets and the stepper share one wrap group, so
          the number you are nudging sits right next to the pills that set it. */}
      <Row label="Quantity">
        {/* On a phone the presets sit on one even row of five and the stepper
            takes the full width below, so both are thumb-sized and nothing
            wraps into a ragged second line. From sm up they share one row. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
          <div className="grid grid-cols-5 gap-1.5 sm:flex sm:gap-1.5">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQtyFromControl(n)}
              aria-pressed={qty === n}
              className={cn(
                "flex h-9 items-center justify-center rounded-full border text-[14px] font-semibold transition-colors sm:px-3",
                qty === n
                  ? "border-dream-purple bg-dream-lavender-soft text-dream-purple-dark"
                  : "border-dream-line bg-white text-dream-muted hover:border-dream-ink/30 hover:text-dream-ink",
              )}
            >
              {n}
            </button>
          ))}
          </div>
          {/* Stepper reads as one more pill in the group; it rings when the
              quantity is off-preset, so the active choice is always obvious. */}
          <div
            className={cn(
              "flex h-10 w-full items-center justify-between overflow-hidden rounded-full border bg-white transition-colors focus-within:border-dream-purple focus-within:ring-1 focus-within:ring-dream-purple sm:h-9 sm:w-auto sm:justify-start",
              isPresetQty ? "border-dream-line" : "border-dream-purple ring-1 ring-dream-purple",
            )}
          >
            <button
              type="button"
              onClick={() => setQtyFromControl(qty - 1)}
              disabled={qty <= QTY_MIN}
              aria-label="Decrease quantity"
              className="flex h-full w-12 shrink-0 items-center justify-center text-lg font-bold text-dream-ink-soft transition-colors hover:bg-dream-bg disabled:opacity-40 disabled:hover:bg-transparent sm:w-9 sm:text-base"
            >
              &minus;
            </button>
            <input
              type="number"
              inputMode="numeric"
              aria-label="Quantity"
              min={QTY_MIN}
              max={QTY_MAX}
              value={qtyText}
              onChange={(e) => onQtyTextChange(e.target.value)}
              onBlur={commitQtyText}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="h-full flex-1 bg-transparent text-center text-sm font-bold text-dream-ink tabular-nums focus:outline-none [appearance:textfield] sm:w-10 sm:flex-none sm:text-[14px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setQtyFromControl(qty + 1)}
              disabled={qty >= QTY_MAX}
              aria-label="Increase quantity"
              className="flex h-full w-12 shrink-0 items-center justify-center text-lg font-bold text-dream-ink-soft transition-colors hover:bg-dream-bg disabled:opacity-40 disabled:hover:bg-transparent sm:w-9 sm:text-base"
            >
              +
            </button>
          </div>
        </div>
      </Row>

      {/* Grounded price summary, the hero of the panel */}
      <div className="rounded-xl border border-dream-lavender-soft bg-dream-lavender-mist px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-wide text-dream-purple-dark/70">
              Your price
            </p>
            <p className="font-display text-3xl font-extrabold leading-none text-dream-purple-dark">
              {formatCAD(result.perUnit)}
              <span className="ml-1 text-sm font-semibold text-dream-purple-dark/60">/unit</span>
            </p>
            {result.discountPct > 0 && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[14px]">
                <span className="text-dream-muted line-through">{formatCAD(result.anchorPerUnit)}</span>
                <span className="rounded-full bg-dream-sun px-2 py-0.5 font-bold text-dream-ink">
                  Save {result.discountPct}%
                </span>
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[14px] font-semibold uppercase tracking-wide text-dream-purple-dark/70">
              {qty} unit{qty === 1 ? "" : "s"}
            </p>
            <p className="font-display text-xl font-bold leading-none text-dream-ink">
              {formatCAD(result.total)}
            </p>
            <p className="mt-1.5 text-[14px] text-dream-muted">est. total</p>
          </div>
        </div>
      </div>

      {/* Estimate note + secondary quick-quote link */}
      <p className="text-center text-[14px] text-dream-muted">
        Estimate only · free art proof before anything prints.
        <Link
          href={quoteHref}
          className="mt-1 block font-semibold text-dream-purple hover:underline"
        >
          Quick quote
        </Link>
      </p>
      </div>
      </div>
      </div>
      </div>
    </div>
  );
}

/* ------------------------------- helpers ------------------------------- */

/** A labelled control row: small caps label above its control. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[14px] font-semibold uppercase tracking-wide text-dream-ink">
        {label}
      </div>
      {children}
    </div>
  );
}

/**
 * Ink-colour picker for one print. A segmented track (same shape as the
 * Decoration toggle above it) rather than four bordered cards: on a phone the
 * cards ate most of the row and read as four separate choices instead of one.
 */
function Chips({
  values,
  selected,
  onSelect,
}: {
  values: number[];
  selected: number;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-dream-bg p-1">
      {values.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelect(n)}
          aria-pressed={n === selected}
          className={cn(
            "h-7 flex-1 rounded-full text-[14px] font-semibold transition-colors",
            n === selected
              ? "bg-dream-ink text-white shadow-sm"
              : "text-dream-ink-soft hover:text-dream-ink",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
