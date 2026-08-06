"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { LINE_PRODUCTION_STATUSES, LINE_PRODUCTION_META, type LineProductionStatus } from "@/lib/lineProduction";
import { Chevron, LineArtwork } from "./LineArtwork";
import { BlankGarment } from "./BlankGarment";
import { ChangeProductDialog } from "./ChangeProductDialog";
import { ReorderArrows } from "./ReorderArrows";
import { DecorationSpotRow } from "./DecorationSpotRow";
import { ProofReviewDialog } from "./ProofReviewDialog";
import { ProofLightbox } from "./ProofLightbox";
import { curveForProduct } from "@/lib/pricing/quote";
import { formatInches } from "@/lib/design/printArea";
import type { DecorationPricingSettings } from "@/lib/pricing/decorationPricing";
import {
  LBL,
  SIZE_ORDER,
  SUPPLIER_OPTIONS,
  itemQty,
  sizeRank,
  suggestLineUnitPrice,
  type Can,
  type ItemState,
  type OrderProduct,
} from "./shared";
import type { DecorationSpot } from "../actions";
import type { LineItemRow, DesignRow, ProofRow } from "@/lib/db/rows";
import { swatchStyle } from "@/lib/swatch";

/**
 * Per-line notes, Julian's taxonomy. Customer notes is the INBOUND record of
 * what the customer submitted in the designer (prefilled at placement,
 * editable to tidy). Nothing typed here reaches the customer: their order page
 * echoes the note exactly as THEY submitted it (design snapshot), and
 * shop-to-customer messaging goes through the Comments composer below.
 */
const LINE_NOTE_FIELDS: {
  key: "customerNotes" | "productionNotes" | "shippingNotes";
  label: string;
  placeholder: string;
  fromCustomer?: boolean;
}[] = [
  { key: "customerNotes", label: "Customer notes", placeholder: "What the customer asked for", fromCustomer: true },
  { key: "productionNotes", label: "Production notes", placeholder: "Manufacturing, e.g. black shirt needs a white underbase" },
  { key: "shippingNotes", label: "Shipping notes", placeholder: "For the shipping label, e.g. gate code" },
];
// internalNotes ("My notes") was dropped from the row per Julian; the storage
// key still round-trips through ItemState so any old data is preserved.

export function OrderItemCard({
  item,
  index,
  lineItem,
  design,
  product,
  customerName,
  orderNumber,
  methodOptions,
  embroideryMethod,
  printMethod,
  can,
  setupFee,
  pricingSettings,
  siblingQty,
  proofsForItem,
  onPatch,
  onRemove,
  onProductChanged,
  onCollapse,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  item: ItemState;
  index: number;
  lineItem: LineItemRow | undefined;
  design: DesignRow | undefined;
  product: OrderProduct | undefined;
  customerName: string;
  orderNumber: string | null;
  methodOptions: string[];
  embroideryMethod: string | undefined;
  printMethod: string | undefined;
  can: Can;
  setupFee: number;
  /** Admin-tuned decoration surcharges, so a reprice matches the shop's quote. */
  pricingSettings: DecorationPricingSettings;
  /** Pieces on the OTHER lines sharing this line's design, for combined-qty tiers. */
  siblingQty: number;
  proofsForItem: ProofRow[];
  onPatch: (fn: (it: ItemState) => ItemState) => void;
  onRemove: () => void;
  /** The line's garment was swapped server-side; sync the local item state. */
  onProductChanged: (productName: string, priceSuggestion: { unit: number; qty: number } | null) => void;
  /** Collapse this line back to a compact row. */
  onCollapse?: () => void;
  /** Move this line up/down the queue. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const [newSize, setNewSize] = useState("");
  const [proofOpen, setProofOpen] = useState(false);
  const [mockupsOpen, setMockupsOpen] = useState(false);
  const [mockupPreview, setMockupPreview] = useState<{ view: string; url: string | null } | null>(null);
  const mockups = ((design?.mockup_images ?? []) as { view: string; url: string | null }[]).filter((m) => m.url);
  const colour = (lineItem?.colour ?? {}) as { name?: string; hex?: string | null };
  const qty = itemQty(item);
  const unit = Number(item.unitPrice) || 0;
  const latestProof = proofsForItem[0];

  // Show the full standard size run as fillable slots, plus any non-standard
  // Only the sizes actually on the line get a column (a tote shouldn't show
  // nine empty apparel sizes). Standard sizes not on the line become small
  // "+XS" pills so any of them is one click away.
  const displaySizes = item.sizes.map(([s]) => s).sort((a, b) => sizeRank(a) - sizeRank(b));
  const missingStandard = SIZE_ORDER.filter((s) => !item.sizes.some(([k]) => k.toUpperCase() === s));
  const qtyOf = (s: string) => item.sizes.find(([k]) => k.toUpperCase() === s.toUpperCase())?.[1] ?? 0;

  /* ------------------------------ auto-repricing ------------------------------
   * Quantities, colour counts and the number of prints all move the curve price,
   * so an edit to any of them refills the unit price from the product's customer
   * curve. The field stays editable: typing over it drops the "auto" chip and the
   * typed number is what saves. Nothing is recomputed on mount, so a stored
   * (possibly hand-agreed) price is never clobbered just by opening the order.
   */
  const curve = useMemo(() => (product ? curveForProduct(product) : null), [product]);

  /** Curve price for a line's CURRENT state (combined qty across the design's lines). */
  const priceFor = (it: ItemState) =>
    suggestLineUnitPrice(curve, it.spots, siblingQty + itemQty(it), pricingSettings);

  /** Apply a state patch, then refill the price from the curve when it can. */
  const patchPriced = (fn: (it: ItemState) => ItemState) =>
    onPatch((prev) => {
      const next = fn(prev);
      if (!can.pricing) return next;
      const suggestion = priceFor(next);
      if (!suggestion) return next;
      return {
        ...next,
        unitPrice: suggestion.unit.toFixed(2),
        autoPrice: { unit: suggestion.unit, qty: suggestion.qty },
        // The stale-price nudge from a product swap is answered by this reprice.
        priceSuggestion: null,
      };
    });

  const setSizeQty = (s: string, val: number) =>
    patchPriced((p) => {
      const has = p.sizes.some(([k]) => k.toUpperCase() === s.toUpperCase());
      const sizes: [string, number][] = has
        ? p.sizes.map(([k, v]) => (k.toUpperCase() === s.toUpperCase() ? [k, val] : [k, v]))
        : [...p.sizes, [s, val] as [string, number]].sort(([a], [b]) => sizeRank(a) - sizeRank(b));
      return { ...p, sizes };
    });

  const removeSize = (s: string) =>
    patchPriced((p) => ({ ...p, sizes: p.sizes.filter(([k]) => k.toUpperCase() !== s.toUpperCase()) }));

  const addSizeColumn = (s: string) =>
    patchPriced((p) =>
      p.sizes.some(([k]) => k.toUpperCase() === s.toUpperCase())
        ? p
        : { ...p, sizes: [...p.sizes, [s, 0] as [string, number]].sort(([a], [b]) => sizeRank(a) - sizeRank(b)) },
    );

  /** Spot fields that move the price: the method, the colour count, the size. */
  const PRICED_SPOT_KEYS: (keyof DecorationSpot)[] = ["type", "colours", "widthIn", "heightIn"];

  const patchSpot = (si: number, patch: Partial<DecorationSpot>) => {
    const apply = (it: ItemState): ItemState => ({
      ...it,
      spots: it.spots.map((s, i) => (i === si ? { ...s, ...patch } : s)),
    });
    const priced = Object.keys(patch).some((k) => PRICED_SPOT_KEYS.includes(k as keyof DecorationSpot));
    return priced ? patchPriced(apply) : onPatch(apply);
  };

  const addSpot = (type: string) =>
    patchPriced((it) => ({
      ...it,
      spots: [
        ...it.spots,
        { location: "", type, widthIn: "", heightIn: "", colours: "", pantones: [], puff: false, spotProcess: false },
      ],
    }));

  const removeSpot = (si: number) => patchPriced((p) => ({ ...p, spots: p.spots.filter((_, i) => i !== si) }));

  function addSize() {
    const s = newSize.trim().toUpperCase();
    if (s && !item.sizes.some(([k]) => k.toUpperCase() === s)) {
      onPatch((p) => ({
        ...p,
        sizes: [...p.sizes, [s, 0] as [string, number]].sort(([a], [b]) => sizeRank(a) - sizeRank(b)),
      }));
    }
    setNewSize("");
  }

  // Line-level finishing options, rendered inside the first print's Advanced spec dropdown.
  const finishingSpec = (
    <div className="flex flex-col gap-1.5">
      <div className={LBL}>Finishing</div>
      <Checkbox
        label="Individual bagging"
        checked={item.bagging}
        disabled={!can.edit}
        onChange={(e) => onPatch((p) => ({ ...p, bagging: e.target.checked }))}
      />
      <Checkbox
        label="Sewn-on size tags"
        checked={item.sewnTags}
        disabled={!can.edit}
        onChange={(e) => onPatch((p) => ({ ...p, sewnTags: e.target.checked }))}
      />
    </div>
  );

  return (
    <>
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row">
          {/* LEFT, supplier blanks on top, primary mockup, proof controls, artwork dropdowns */}
          <div className="flex shrink-0 flex-col gap-3 lg:w-44">
            <BlankGarment product={product} colour={colour} />

            {mockups.length === 0 ? (
              <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dream-line bg-dream-bg text-xs text-dream-faint">
                No mockup
              </div>
            ) : (
              <figure className="rounded-xl border border-dream-line p-2">
                <figcaption className="mb-1 text-xs font-medium capitalize text-dream-ink">{mockups[0].view}</figcaption>
                <button
                  type="button"
                  onClick={() => setMockupPreview(mockups[0])}
                  title="Click to view full size"
                  className="block h-32 w-full overflow-hidden rounded-lg bg-dream-bg"
                >
                  <Image src={mockups[0].url!} alt={`${mockups[0].view} mockup`} width={160} height={160} className="h-full w-full object-contain" />
                </button>
              </figure>
            )}

            <div className="space-y-1 text-sm">
              {design?.name && <div className="font-medium text-dream-ink">“{design.name}”</div>}
              <span className="inline-flex items-center gap-1.5 text-dream-muted">
                Colour:
                <span className="h-3.5 w-3.5 rounded-full border border-dream-line-strong" style={swatchStyle({ name: colour.name ?? "", hex: colour.hex ?? null })} />
                <span className="font-medium text-dream-ink">{colour.name ?? "-"}</span>
              </span>
            </div>

            {can.proofs && (
              <div className="space-y-2">
                {latestProof && (
                  <Badge
                    variant={
                      latestProof.status === "approved" ? "success" : latestProof.status === "changes_requested" ? "warn" : "info"
                    }
                  >
                    Proof: {latestProof.status.replace(/_/g, " ")}
                  </Badge>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" size="sm" onClick={() => setProofOpen(true)}>
                    {latestProof ? "Add new proof" : "Upload proof"}
                  </Button>
                  {latestProof?.image && (
                    // New tab, so the real file (PDF included) opens in the
                    // browser's own viewer and the order page stays put.
                    <a
                      href={latestProof.image}
                      target="_blank"
                      rel="noopener"
                      className="text-sm text-dream-purple hover:underline"
                    >
                      View proof
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Raw customer artwork + all mockup views, CR-style dropdowns. */}
            <div className="space-y-2 border-t border-dream-line pt-3">
              <LineArtwork design={design} />
              {mockups.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setMockupsOpen((o) => !o)}
                    className="flex items-center gap-1 text-sm font-medium text-dream-ink transition-colors hover:text-dream-purple"
                  >
                    Mockups ({mockups.length})
                    <Chevron open={mockupsOpen} />
                  </button>
                  {mockupsOpen && (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {mockups.map((m) => (
                        <button
                          key={m.view}
                          type="button"
                          onClick={() => setMockupPreview(m)}
                          title={`${m.view} mockup, click to view full size`}
                          className="flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-dream-line bg-dream-bg p-1 transition-colors hover:border-dream-purple"
                        >
                          <Image src={m.url!} alt={`${m.view} mockup`} width={56} height={56} className="min-h-0 w-full flex-1 object-contain" />
                          <span className="text-[9px] font-medium capitalize text-dream-muted">{m.view}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MIDDLE, product, sizes, print, notes */}
          <div className="min-w-0 flex-1 space-y-5">
            <div className="flex items-center gap-2">
              {onMoveUp && onMoveDown && (
                <ReorderArrows onUp={onMoveUp} onDown={onMoveDown} disableUp={!!isFirst} disableDown={!!isLast} />
              )}
              {onCollapse && (
                <button
                  type="button"
                  onClick={onCollapse}
                  aria-label="Collapse line"
                  title="Collapse line"
                  className="rounded p-1 text-dream-faint transition-colors hover:bg-dream-bg hover:text-dream-ink"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 rotate-90" aria-hidden>
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <span className="text-sm text-dream-faint">{index + 1}.</span>
              <Input
                value={item.productName}
                disabled={!can.edit}
                onChange={(e) => onPatch((p) => ({ ...p, productName: e.target.value }))}
                className="flex-1 font-semibold text-dream-ink"
              />
              <Select
                value={item.productionStatus}
                disabled={!can.edit}
                title="Production status for this line"
                onChange={(e) => onPatch((p) => ({ ...p, productionStatus: e.target.value as LineProductionStatus }))}
                className="h-9 w-40 shrink-0"
              >
                {LINE_PRODUCTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LINE_PRODUCTION_META[s].label}
                  </option>
                ))}
              </Select>
              {can.edit && (
                <button
                  type="button"
                  aria-label="Remove item"
                  className="rounded p-1 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
                  onClick={onRemove}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {product?.ss_style_name ? (
                <SsSource product={product} />
              ) : (
                <span className="text-sm text-dream-muted">No product linked</span>
              )}
              {can.edit && lineItem && (
                <ChangeProductDialog
                  orderId={lineItem.order_id}
                  lineItemId={lineItem.id}
                  currentProductId={product?.id}
                  onChanged={onProductChanged}
                />
              )}

              {/* Line ops: where the blanks come from and whether they're in hand. */}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5">
                  <span className={LBL}>Supplier</span>
                  <Select
                    value={item.supplier}
                    disabled={!can.edit}
                    title="Where the blanks for this line are coming from"
                    onChange={(e) => onPatch((p) => ({ ...p, supplier: e.target.value }))}
                    className="h-8 w-40 py-0 leading-none"
                  >
                    <option value="">Not set</option>
                    {SUPPLIER_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    {item.supplier && !SUPPLIER_OPTIONS.includes(item.supplier) && (
                      <option value={item.supplier}>{item.supplier}</option>
                    )}
                  </Select>
                </label>
                <button
                  type="button"
                  disabled={!can.edit}
                  aria-pressed={item.fulfilled}
                  title={item.fulfilled ? "Blanks are in hand" : "Mark the blanks for this line as received"}
                  onClick={() => onPatch((p) => ({ ...p, fulfilled: !p.fulfilled }))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    item.fulfilled
                      ? "border-transparent bg-dream-success-soft text-dream-success"
                      : "border-dream-line bg-white text-dream-muted hover:border-dream-purple hover:text-dream-purple",
                    !can.edit && "cursor-not-allowed opacity-60",
                  )}
                >
                  {item.fulfilled ? (
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
                      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-current" aria-hidden />
                  )}
                  {item.fulfilled ? "Fulfilled" : "Mark fulfilled"}
                </button>
              </div>
            </div>

            {/* Sizes, one horizontal row of size columns */}
            <div>
              <div className={cn(LBL, "mb-2")}>Sizes ({qty} pcs)</div>
              <div className="flex flex-wrap items-start gap-1.5">
                {displaySizes.map((s) => {
                  const q = qtyOf(s);
                  return (
                    // Narrow, centred boxes: a size run is 1-3 digits per size,
                    // wide inputs just push the run off the card. Long custom
                    // names ("One size") get a wider column; the label never
                    // wraps so every input sits on the same baseline.
                    <div key={s} className={cn(s.length > 4 ? "w-16" : "w-11")}>
                      <div
                        title={s}
                        className="mb-1 h-4 truncate whitespace-nowrap text-center text-xs font-semibold uppercase leading-4 text-dream-muted"
                      >
                        {s}
                      </div>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={q === 0 ? "" : q}
                        placeholder="0"
                        disabled={!can.edit}
                        onChange={(e) => setSizeQty(s, Math.max(0, Number(e.target.value) || 0))}
                        className="h-9 px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      {can.edit && (
                        <button
                          type="button"
                          aria-label={`Remove size ${s}`}
                          title={`Remove size ${s}`}
                          tabIndex={-1}
                          className="mx-auto mt-1 block h-4 w-4 rounded text-xs leading-none text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
                          onClick={() => removeSize(s)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
                {can.edit && missingStandard.length > 0 && (
                  <div>
                    <div className="mb-1 h-4" aria-hidden />
                    <div className="flex h-9 flex-wrap items-center gap-1">
                      {missingStandard.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => addSizeColumn(s)}
                          title={`Add size ${s}`}
                          tabIndex={-1}
                          className="rounded-md border border-dashed border-dream-line px-1.5 py-1 text-[10px] font-bold uppercase leading-none text-dream-faint transition-colors hover:border-dream-purple hover:text-dream-purple"
                        >
                          +{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {can.edit && (
                  <div className="w-24">
                    <div className="mb-1 text-center text-[10px] font-semibold uppercase text-dream-faint">Eg. S or M</div>
                    <div className="flex items-center gap-1">
                      <Input
                        value={newSize}
                        onChange={(e) => setNewSize(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSize();
                          }
                        }}
                        className="h-9 text-center text-xs"
                      />
                      <Button variant="secondary" size="sm" className="h-9" onClick={addSize} disabled={!newSize.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Print / decoration section */}
            <div className="space-y-3">
              <div className={LBL}>
                Print ({item.spots.length} spot{item.spots.length === 1 ? "" : "s"})
              </div>
              {/* Per-garment-size print limits from the product's print areas,
                  so the artist sizing a mixed run (XS through 3XL) has the real
                  numbers in front of them instead of one adult max. */}
              {(product?.printAreas ?? []).some((pa) => pa.sizeLimits.length > 0) && (
                <div className="rounded-lg bg-dream-bg px-3 py-2 text-xs text-dream-muted">
                  <span className="font-semibold text-dream-ink">Max print by garment size: </span>
                  {(product?.printAreas ?? [])
                    .filter((pa) => pa.sizeLimits.length > 0)
                    .map(
                      (pa) =>
                        `${pa.name}: ${pa.sizeLimits
                          .map((r) => `${r.label} ${formatInches(r.maxWidthIn, r.maxHeightIn)}`)
                          .join(" · ")}`,
                    )
                    .join("  |  ")}
                </div>
              )}
              {item.spots.map((spot, si) => (
                <DecorationSpotRow
                  key={si}
                  spot={spot}
                  index={si}
                  methodOptions={methodOptions}
                  canEdit={can.edit}
                  onPatch={(patch) => patchSpot(si, patch)}
                  onRemove={() => removeSpot(si)}
                  extraSpec={si === 0 ? finishingSpec : undefined}
                  extraSpecActive={si === 0 && (item.bagging || item.sewnTags)}
                />
              ))}
              {/* No prints on this line, the finishing options still need a home. */}
              {item.spots.length === 0 && (
                <div className="rounded-lg border border-dream-line p-3">{finishingSpec}</div>
              )}
              {can.edit && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => addSpot(printMethod ?? methodOptions[0] ?? "")}>
                    Add print
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => addSpot(embroideryMethod ?? methodOptions[0] ?? "")}>
                    Add embroidery
                  </Button>
                </div>
              )}
            </div>

            {/* Per-line notes, specific to THIS garment (different items differ) */}
            <div className="grid gap-3 sm:grid-cols-3">
              {LINE_NOTE_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={LBL}>{f.label}</span>
                    {f.fromCustomer ? (
                      <span
                        title="What they submitted with the order. Edits here stay internal; reply via a Customer comment."
                        className="rounded bg-dream-info-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-dream-info"
                      >
                        From the customer
                      </span>
                    ) : (
                      <span className="rounded bg-dream-line px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-dream-muted">
                        Internal
                      </span>
                    )}
                  </div>
                  <Textarea
                    rows={2}
                    value={item[f.key]}
                    disabled={!can.edit}
                    placeholder={f.placeholder}
                    onChange={(e) => onPatch((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

          </div>

          {/* RIGHT, price */}
          <div className="shrink-0 border-t border-dream-line pt-4 lg:w-48 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className={cn(LBL, "mb-1")}>Unit price</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-dream-muted">$</span>
              <Input
                value={item.unitPrice}
                disabled={!can.pricing}
                // Typing a price by hand wins: the auto chip drops off and the
                // number is left alone until the next pricing-relevant edit.
                onChange={(e) => onPatch((p) => ({ ...p, unitPrice: e.target.value, autoPrice: null }))}
                className="h-9 w-24"
              />
              {item.autoPrice && (
                <span
                  title="Recalculated from this product's price tiers. Type over it to override."
                  className="rounded-full bg-dream-lavender-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dream-purple"
                >
                  Auto
                </span>
              )}
            </div>
            {/* No "Priced for N pcs" line: the x N below already says it, and the
                Auto chip above already says the price came from the tiers. */}
            <div className="mt-1 text-sm text-dream-muted">× {qty} units</div>
            <div className="mt-4 border-t border-dream-line pt-4">
              <div className="font-display text-xl font-bold text-dream-ink">{formatCAD(unit * qty + setupFee)}</div>
              <div className="text-xs text-dream-muted">
                {formatCAD(unit)} × {qty}
                {setupFee > 0 && <> + {formatCAD(setupFee)} setup</>}
              </div>
            </div>

            {/* Stale-price nudge after a product swap; the new product's curve
                price at this quantity. Apply/Dismiss go through Save changes. */}
            {item.priceSuggestion && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-dream-warn bg-dream-warn-soft p-2.5 text-xs text-dream-ink">
                <p>
                  Price may be stale after the product change. This product&apos;s tier price is{" "}
                  <strong>{formatCAD(item.priceSuggestion.unit)}</strong>/unit at {item.priceSuggestion.qty} pcs.
                </p>
                <div className="flex items-center gap-3">
                  {can.pricing && (
                    <button
                      type="button"
                      className="font-semibold text-dream-purple hover:underline"
                      onClick={() =>
                        onPatch((p) => ({
                          ...p,
                          unitPrice: String(p.priceSuggestion?.unit ?? p.unitPrice),
                          priceSuggestion: null,
                        }))
                      }
                    >
                      Apply {formatCAD(item.priceSuggestion.unit)}
                    </button>
                  )}
                  {can.edit && (
                    <button
                      type="button"
                      className="text-dream-muted hover:underline"
                      onClick={() => onPatch((p) => ({ ...p, priceSuggestion: null }))}
                    >
                      Keep current price
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>

    {can.proofs && lineItem && (
      <ProofReviewDialog
        orderId={lineItem.order_id}
        lineItemId={lineItem.id}
        open={proofOpen}
        onOpenChange={setProofOpen}
        orderNumber={orderNumber}
        customerName={customerName}
        contextLabel={item.productName || undefined}
        isReplacement={!!latestProof}
      />
    )}
    {mockupPreview?.url && (
      <ProofLightbox
        src={mockupPreview.url}
        kind="image"
        title={`${mockupPreview.view} mockup`}
        open={!!mockupPreview}
        onOpenChange={(o) => !o && setMockupPreview(null)}
      />
    )}
    </>
  );
}

/** The S&S blank this garment came from, the brand + style number Julian reorders by. */
function SsSource({ product }: { product: OrderProduct }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className={LBL}>S&amp;S blank</span>
      <span className="font-semibold text-dream-ink">
        {product.brand ? `${product.brand} ${product.ss_style_name}` : product.ss_style_name}
      </span>
    </div>
  );
}
