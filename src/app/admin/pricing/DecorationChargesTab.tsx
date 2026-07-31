"use client";

/**
 * Decoration charges, rush options and add-ons. These used to be two tabs
 * inside Settings, which meant "what does this cost" was answered in three
 * different places (here, Settings, and the product editor). They now live on
 * the Pricing page beside the price lists they adjust.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import type { QtyBreak, DecorationPricingSettings } from "@/lib/pricing/decorationPricing";
import type { AddonSettings } from "@/lib/addonSettings";
import { updateDecorationPricingAction, updateAddonSettingsAction } from "@/app/admin/settings/actions";

/* ------------------------------------------------------------------ */
/* Pricing (screen print, embroidery, rush options)                   */
/* ------------------------------------------------------------------ */

/** Rows are held as strings so a half-typed number never snaps back to 0. */
interface BreakRowDraft {
  id: string;
  minQty: string;
  price: string;
}

interface RushRowDraft {
  id: string;
  days: string;
  pct: string;
}

let pricingRowSeq = 0;
const newRowId = () => `row-${Date.now()}-${pricingRowSeq++}`;

/** Dollars: never negative, rounded to whole cents. */
const dollars = (v: string) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
/** Whole non-negative number (quantities, days). */
const whole = (v: string) => Math.max(0, Math.round(Number(v) || 0));

const toBreakRows = (breaks: QtyBreak[]): BreakRowDraft[] =>
  breaks.map((b) => ({ id: newRowId(), minQty: String(b.minQty), price: String(b.price) }));

/** Drop blank rows, clamp negatives, keep sorted by quantity. */
const fromBreakRows = (rows: BreakRowDraft[]): QtyBreak[] =>
  rows
    .map((r) => ({ minQty: whole(r.minQty), price: dollars(r.price) }))
    .filter((b) => b.minQty > 0)
    .sort((a, b) => a.minQty - b.minQty);

const REMOVE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * Quantity-break editor: "from this many pieces, charge this much each".
 * Used for the extra print location tables on both decoration methods.
 */
function QtyBreakTable({
  idPrefix,
  rows,
  onChange,
}: {
  idPrefix: string;
  rows: BreakRowDraft[];
  onChange: (rows: BreakRowDraft[]) => void;
}) {
  const patch = (index: number, field: "minQty" | "price", value: string) =>
    onChange(rows.map((r, j) => (j === index ? { ...r, [field]: value } : r)));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-dream-muted">
        <span className="w-24">From qty</span>
        <span className="w-28">Per piece</span>
      </div>
      {rows.map((row, i) => (
        <div key={row.id} className="flex items-center gap-1.5">
          <Input
            id={`${idPrefix}-qty-${i}`}
            aria-label="From quantity"
            type="number"
            min={1}
            step="1"
            value={row.minQty}
            placeholder="25"
            onChange={(e) => patch(i, "minQty", e.target.value)}
            className="h-8 w-24"
          />
          <div className="flex w-28 items-center gap-1">
            <span className="text-sm text-dream-muted">$</span>
            <Input
              id={`${idPrefix}-price-${i}`}
              aria-label="Charge per piece"
              type="number"
              min={0}
              step="0.01"
              value={row.price}
              placeholder="0.00"
              onChange={(e) => patch(i, "price", e.target.value)}
              className="h-8 min-w-0"
            />
          </div>
          <button
            type="button"
            aria-label={`Remove the ${row.minQty || "new"} piece row`}
            title={rows.length <= 1 ? "Keep at least one row" : "Remove this row"}
            disabled={rows.length <= 1}
            className="shrink-0 rounded p-1 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-dream-faint"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            {REMOVE_ICON}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs font-semibold text-dream-purple hover:underline"
        onClick={() => onChange([...rows, { id: newRowId(), minQty: "", price: "" }])}
      >
        + Add row
      </button>
    </div>
  );
}

/** Colour counts Julian can price. 1 colour is always free, so it is read-only. */
const COLOUR_COUNTS = [2, 3, 4, 5, 6, 7, 8];

/**
 * What a group of settings actually changes. This tab mixes three blast radii,
 * and rendering them as identical dollar fields made "is this charged?"
 * unanswerable without reading the code, so every group states its own answer.
 */
function Affects({ kind }: { kind: "customer" | "admin" }) {
  const meta = {
    customer: {
      label: "Changes customer prices",
      cls: "bg-dream-lavender-soft text-dream-purple-dark",
    },
    admin: { label: "Admin repricing only", cls: "bg-dream-info-soft text-dream-info" },
  }[kind];
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        meta.cls,
      )}
    >
      {meta.label}
    </span>
  );
}

/** Subsection heading: title, optional InfoTip, and the blast-radius tag. */
function PricingGroupTitle({
  title,
  tip,
  affects,
}: {
  title: string;
  tip?: string;
  affects: "customer" | "admin";
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-sm font-semibold text-dream-ink">{title}</span>
      {tip && <InfoTip text={tip} />}
      <Affects kind={affects} />
    </div>
  );
}

export function DecorationChargesTab({ settings }: { settings: DecorationPricingSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [colourSurcharge, setColourSurcharge] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (const count of COLOUR_COUNTS) initial[count] = String(settings.screen.colourSurcharge[count] ?? 0);
    return initial;
  });
  const [screenLocationRows, setScreenLocationRows] = useState<BreakRowDraft[]>(() =>
    toBreakRows(settings.screen.extraLocationPerPiece)
  );

  const [embLocationRows, setEmbLocationRows] = useState<BreakRowDraft[]>(() =>
    toBreakRows(settings.embroidery.extraLocationPerPiece)
  );
  const [includedSqIn, setIncludedSqIn] = useState(String(settings.embroidery.includedSqIn));
  const [perExtraSqIn, setPerExtraSqIn] = useState(String(settings.embroidery.perExtraSqInPerPiece));

  const [standardDays, setStandardDays] = useState(String(settings.standardDays));
  const [rushRows, setRushRows] = useState<RushRowDraft[]>(() =>
    settings.rushTiers.map((t) => ({ id: t.id, days: String(t.days), pct: String(t.pct) }))
  );

  function save() {
    const colours: Record<number, number> = { 1: 0 };
    for (const count of COLOUR_COUNTS) colours[count] = dollars(colourSurcharge[count] ?? "0");

    const payload: DecorationPricingSettings = {
      screen: {
        colourSurcharge: colours,
        extraLocationPerPiece: fromBreakRows(screenLocationRows),
      },
      embroidery: {
        extraLocationPerPiece: fromBreakRows(embLocationRows),
        includedSqIn: Math.max(0, Number(includedSqIn) || 0),
        perExtraSqInPerPiece: dollars(perExtraSqIn),
      },
      standardDays: whole(standardDays) || settings.standardDays,
      rushTiers: rushRows
        .map((r) => ({ id: r.id, days: whole(r.days), pct: Math.max(0, Number(r.pct) || 0) }))
        .filter((t) => t.days > 0 && t.pct > 0)
        .sort((a, b) => b.days - a.days),
    };

    start(async () => {
      const res = await updateDecorationPricingAction(payload);
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Pricing saved", variant: "success" });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-dream-muted">
        Product base prices live on each product&rsquo;s pricing profile. These settings adjust them. Not everything
        here is charged automatically, so each group says what it affects.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Screen printing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <PricingGroupTitle
              title="Extra colour charge per piece"
              tip="What each piece costs extra when a print has this many colours in it."
              affects="customer"
            />
            <p className="mt-1 text-xs text-dream-muted">
              Counted per print. A 3 colour front and a 1 colour back only charges the 3 colour rate on the front.
            </p>
            <p className="mt-2 text-xs font-medium text-dream-ink">1 colour is included at no extra charge.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {COLOUR_COUNTS.map((count) => (
                <Field key={count} label={`${count} colours`} htmlFor={`dp-colour-${count}`}>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-dream-muted">$</span>
                    <Input
                      id={`dp-colour-${count}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={colourSurcharge[count] ?? ""}
                      onChange={(e) => setColourSurcharge((prev) => ({ ...prev, [count]: e.target.value }))}
                      className="min-w-0"
                    />
                  </div>
                </Field>
              ))}
            </div>
          </div>

          <div className="border-t border-dream-line pt-4">
            <PricingGroupTitle
              title="Extra print location per piece"
              tip="Charged for every print location after the first, for example a back print or a sleeve. Bigger orders normally pay less per piece."
              affects="customer"
            />
            <p className="mt-1 mb-3 text-xs text-dream-muted">
              The row with the highest quantity at or below the order size wins.
            </p>
            <QtyBreakTable idPrefix="dp-screen-loc" rows={screenLocationRows} onChange={setScreenLocationRows} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embroidery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <PricingGroupTitle
              title="Extra embroidery location per piece"
              tip="Charged for every embroidery location after the first, for example a hat back or a sleeve."
              affects="customer"
            />
            <p className="mt-1 mb-3 text-xs text-dream-muted">
              The row with the highest quantity at or below the order size wins.
            </p>
            <QtyBreakTable idPrefix="dp-emb-loc" rows={embLocationRows} onChange={setEmbLocationRows} />
          </div>

          <div className="border-t border-dream-line pt-4">
            <PricingGroupTitle
              title="Stitch size charge"
              tip="Charges for embroidery bigger than the included size."
              affects="admin"
            />
            <p className="mt-1 mb-3 text-xs text-dream-muted">
              Only applies when you edit a line in the admin. The customer&rsquo;s own estimate never includes it.
            </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
            <Field
              label="Included size (square inches)"
              htmlFor="dp-emb-included"
              hint="Stitch area covered by the base price. A 3 by 3 inch left chest logo is 9 square inches."
            >
              <Input
                id="dp-emb-included"
                type="number"
                min={0}
                step="0.5"
                value={includedSqIn}
                onChange={(e) => setIncludedSqIn(e.target.value)}
              />
            </Field>
            <Field
              label="Charge per extra square inch, per piece"
              htmlFor="dp-emb-per-sqin"
              hint="Applies to every square inch above the included size. 0 means size does not change the price."
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-dream-muted">$</span>
                <Input
                  id="dp-emb-per-sqin"
                  type="number"
                  min={0}
                  step="0.01"
                  value={perExtraSqIn}
                  onChange={(e) => setPerExtraSqIn(e.target.value)}
                />
              </div>
            </Field>
          </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rush options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="max-w-xs">
            <Field
              label="Standard production time (business days)"
              htmlFor="dp-standard-days"
              hint="Your normal turnaround, shown next to the rush choices."
            >
              <Input
                id="dp-standard-days"
                type="number"
                min={1}
                step="1"
                value={standardDays}
                onChange={(e) => setStandardDays(e.target.value)}
              />
            </Field>
          </div>

          <div className="border-t border-dream-line pt-4">
            <PricingGroupTitle
              title="Rush choices"
              tip="The I just want it sooner options customers see at checkout. The percent is charged on the pre-tax job total."
              affects="customer"
            />
            <p className="mt-1 mb-3 text-xs text-dream-muted">
              Remove every row to hide rush options from customers.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-dream-muted">
                <span className="w-24">Business days</span>
                <span className="w-24">Extra %</span>
              </div>
              {rushRows.map((row, i) => (
                <div key={row.id} className="flex items-center gap-1.5">
                  <Input
                    id={`dp-rush-days-${i}`}
                    aria-label="Business days"
                    type="number"
                    min={1}
                    step="1"
                    value={row.days}
                    placeholder="5"
                    onChange={(e) =>
                      setRushRows(rushRows.map((r, j) => (j === i ? { ...r, days: e.target.value } : r)))
                    }
                    className="h-8 w-24"
                  />
                  <div className="flex w-24 items-center gap-1">
                    <Input
                      id={`dp-rush-pct-${i}`}
                      aria-label="Extra percent"
                      type="number"
                      min={0}
                      step="1"
                      value={row.pct}
                      placeholder="15"
                      onChange={(e) =>
                        setRushRows(rushRows.map((r, j) => (j === i ? { ...r, pct: e.target.value } : r)))
                      }
                      className="h-8 min-w-0"
                    />
                    <span className="text-sm text-dream-muted">%</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove the ${row.days || "new"} day rush option`}
                    title="Remove this rush option"
                    className="shrink-0 rounded p-1 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
                    onClick={() => setRushRows(rushRows.filter((_, j) => j !== i))}
                  >
                    {REMOVE_ICON}
                  </button>
                </div>
              ))}
              {rushRows.length === 0 && (
                <p className="text-[11px] text-dream-faint">
                  No rush options. Customers only see your standard turnaround.
                </p>
              )}
              <button
                type="button"
                className="text-xs font-semibold text-dream-purple hover:underline"
                onClick={() => setRushRows([...rushRows, { id: newRowId(), days: "", pct: "" }])}
              >
                + Add rush option
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" loading={pending} onClick={save}>
          Save pricing
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add-on charges                                                     */
/* ------------------------------------------------------------------ */

export function AddonsTab({ settings }: { settings: AddonSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [bagging, setBagging] = useState(String(settings.baggingPerUnit));
  const [sewnTags, setSewnTags] = useState(String(settings.sewnTagsPerUnit));
  const [spotProcess, setSpotProcess] = useState(String(settings.spotProcessPerUnit));

  function save() {
    start(async () => {
      const res = await updateAddonSettingsAction({
        baggingPerUnit: Number(bagging) || 0,
        sewnTagsPerUnit: Number(sewnTags) || 0,
        spotProcessPerUnit: Number(spotProcess) || 0,
      });
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Add-on charges saved", variant: "success" });
        router.refresh();
      }
    });
  }

  const fields: { label: string; hint: string; value: string; onChange: (v: string) => void; id: string }[] = [
    { id: "addon-bagging", label: "Individual bagging", hint: "Per garment, when the line is bagged individually.", value: bagging, onChange: setBagging },
    { id: "addon-tags", label: "Sewn-on size tags", hint: "Per garment, when the line has sewn-on tags.", value: sewnTags, onChange: setSewnTags },
    { id: "addon-spot", label: "Spot process", hint: "Per garment, for each print spot marked spot process.", value: spotProcess, onChange: setSpotProcess },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-dream-muted">
        Per-garment charges added to an order when you tick the matching option on a line (bagging, sewn tags, spot
        process). They fold into the order total and the customer&apos;s invoice. The customer&apos;s self-serve quote is
        not affected.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Add-on charges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {fields.map((f) => (
              <Field key={f.id} label={f.label} htmlFor={f.id}>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-dream-muted">$</span>
                  <Input
                    id={f.id}
                    type="number"
                    min={0}
                    step="0.01"
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                  />
                </div>
                <p className="mt-1 text-xs text-dream-muted">{f.hint}</p>
              </Field>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="primary" loading={pending} onClick={save}>
              Save add-on charges
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

