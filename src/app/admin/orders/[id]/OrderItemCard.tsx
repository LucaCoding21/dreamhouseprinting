"use client";

import { useState } from "react";
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
import { LineArtwork } from "./LineArtwork";
import { BlankGarment } from "./BlankGarment";
import { ReorderArrows } from "./ReorderArrows";
import { DecorationSpotRow } from "./DecorationSpotRow";
import { ProofReviewDialog } from "./ProofReviewDialog";
import { ProofLightbox, fileKind } from "./ProofLightbox";
import { LBL, SIZE_ORDER, itemQty, sizeRank, type Can, type ItemState, type OrderProduct } from "./shared";
import type { DecorationSpot } from "../actions";
import type { LineItemRow, DesignRow, ProofRow } from "@/lib/db/rows";

/** The three kinds of per-line notes (ticket: production / internal / shipping). */
const LINE_NOTE_FIELDS: { key: "productionNotes" | "internalNotes" | "shippingNotes"; label: string; placeholder: string }[] = [
  { key: "productionNotes", label: "Production notes", placeholder: "Manufacturing, e.g. black shirt needs a white underbase" },
  { key: "internalNotes", label: "Internal notes", placeholder: "Private for the team. The customer never sees this" },
  { key: "shippingNotes", label: "Shipping notes", placeholder: "For the shipping label, e.g. gate code" },
];

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
  can,
  setupFee,
  proofsForItem,
  onPatch,
  onRemove,
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
  can: Can;
  setupFee: number;
  proofsForItem: ProofRow[];
  onPatch: (fn: (it: ItemState) => ItemState) => void;
  onRemove: () => void;
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mockups = ((design?.mockup_images ?? []) as { view: string; url: string | null }[]).filter((m) => m.url);
  const colour = (lineItem?.colour ?? {}) as { name?: string; hex?: string | null };
  const qty = itemQty(item);
  const unit = Number(item.unitPrice) || 0;
  const latestProof = proofsForItem[0];

  // Show the full standard size run as fillable slots, plus any non-standard
  // sizes already on the line (case-insensitive match against SIZE_ORDER).
  const isStandard = (s: string) => SIZE_ORDER.includes(s.toUpperCase());
  const customSizes = item.sizes.map(([s]) => s).filter((s) => !isStandard(s));
  const displaySizes = [...SIZE_ORDER, ...customSizes];
  const qtyOf = (s: string) => item.sizes.find(([k]) => k.toUpperCase() === s.toUpperCase())?.[1] ?? 0;

  const setSizeQty = (s: string, val: number) =>
    onPatch((p) => {
      const has = p.sizes.some(([k]) => k.toUpperCase() === s.toUpperCase());
      const sizes: [string, number][] = has
        ? p.sizes.map(([k, v]) => (k.toUpperCase() === s.toUpperCase() ? [k, val] : [k, v]))
        : [...p.sizes, [s, val] as [string, number]].sort(([a], [b]) => sizeRank(a) - sizeRank(b));
      return { ...p, sizes };
    });

  const patchSpot = (si: number, patch: Partial<DecorationSpot>) =>
    onPatch((it) => ({ ...it, spots: it.spots.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));

  const addSpot = (type: string) =>
    onPatch((it) => ({
      ...it,
      spots: [
        ...it.spots,
        { location: "", type, widthIn: "", heightIn: "", colours: "", pantones: [], puff: false, spotProcess: false },
      ],
    }));

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

  // Line-level finishing options — rendered inside the first print's Advanced spec dropdown.
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
          {/* LEFT — mockups, design + colour, proof controls */}
          <div className="flex shrink-0 flex-col gap-3 lg:w-44">
            <div className="flex gap-3 lg:flex-col">
              {mockups.length === 0 ? (
                <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dream-line bg-dream-bg text-xs text-dream-faint">
                  No mockup
                </div>
              ) : (
                mockups.map((m) => (
                  <figure key={m.view} className="w-32 rounded-xl border border-dream-line p-2">
                    <figcaption className="mb-1 text-xs font-medium capitalize text-dream-ink">{m.view}</figcaption>
                    <div className="h-28 w-full overflow-hidden rounded-lg bg-dream-bg">
                      <Image src={m.url!} alt={`${m.view} mockup`} width={112} height={112} className="h-full w-full object-contain" />
                    </div>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noreferrer" className="mt-1 block text-center text-xs text-dream-purple hover:underline">
                        View full
                      </a>
                    )}
                  </figure>
                ))
              )}
            </div>

            <div className="space-y-1 text-sm">
              {design?.name && <div className="font-medium text-dream-ink">“{design.name}”</div>}
              <span className="inline-flex items-center gap-1.5 text-dream-muted">
                Colour:
                <span className="h-3.5 w-3.5 rounded-full border border-dream-line-strong" style={{ background: colour.hex ?? "#fff" }} />
                <span className="font-medium text-dream-ink">{colour.name ?? "—"}</span>
              </span>
            </div>

            <div className="space-y-2">
              <LineArtwork design={design} />
              <BlankGarment product={product} colour={colour} />
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
                    {latestProof ? "Send new proof" : "Upload proof"}
                  </Button>
                  {latestProof?.image && (
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="text-sm text-dream-purple hover:underline"
                    >
                      View proof
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* MIDDLE — product, sizes, print, notes */}
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

            {product?.ss_style_name && <SsSource product={product} />}

            {/* Sizes — one horizontal row of size columns */}
            <div>
              <div className={cn(LBL, "mb-2")}>Sizes ({qty} pcs)</div>
              <div className="flex flex-wrap items-start gap-2">
                {displaySizes.map((s) => {
                  const q = qtyOf(s);
                  return (
                    <div key={s} className="w-16">
                      <div className="mb-1 text-center text-xs font-semibold uppercase text-dream-muted">{s}</div>
                      <Input
                        type="number"
                        min={0}
                        value={q === 0 ? "" : q}
                        placeholder="0"
                        disabled={!can.edit}
                        onChange={(e) => setSizeQty(s, Math.max(0, Number(e.target.value) || 0))}
                        className="h-9 px-1.5 text-center"
                      />
                      {can.edit && !isStandard(s) && (
                        <button
                          type="button"
                          aria-label={`Remove size ${s}`}
                          className="mx-auto mt-1 block text-dream-faint hover:text-dream-danger"
                          onClick={() => onPatch((p) => ({ ...p, sizes: p.sizes.filter(([k]) => k !== s) }))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
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
              {item.spots.map((spot, si) => (
                <DecorationSpotRow
                  key={si}
                  spot={spot}
                  index={si}
                  methodOptions={methodOptions}
                  canEdit={can.edit}
                  onPatch={(patch) => patchSpot(si, patch)}
                  onRemove={() => onPatch((p) => ({ ...p, spots: p.spots.filter((_, i) => i !== si) }))}
                  extraSpec={si === 0 ? finishingSpec : undefined}
                  extraSpecActive={si === 0 && (item.bagging || item.sewnTags)}
                />
              ))}
              {/* No prints on this line — the finishing options still need a home. */}
              {item.spots.length === 0 && (
                <div className="rounded-lg border border-dream-line p-3">{finishingSpec}</div>
              )}
              {can.edit && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => addSpot(methodOptions[0] ?? "")}>
                    Add print
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => addSpot(embroideryMethod ?? methodOptions[0] ?? "")}>
                    Add embroidery
                  </Button>
                </div>
              )}
            </div>

            {/* Per-line notes — specific to THIS garment (different items differ) */}
            <div className="grid gap-3 sm:grid-cols-3">
              {LINE_NOTE_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <div className={LBL}>{f.label}</div>
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

          {/* RIGHT — price */}
          <div className="shrink-0 border-t border-dream-line pt-4 lg:w-48 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className={cn(LBL, "mb-1")}>Unit price</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-dream-muted">$</span>
              <Input
                value={item.unitPrice}
                disabled={!can.pricing}
                onChange={(e) => onPatch((p) => ({ ...p, unitPrice: e.target.value }))}
                className="h-9 w-24"
              />
            </div>
            <div className="mt-1 text-sm text-dream-muted">× {qty} units</div>
            <div className="mt-4 border-t border-dream-line pt-4">
              <div className="font-display text-xl font-bold text-dream-ink">{formatCAD(unit * qty + setupFee)}</div>
              <div className="text-xs text-dream-muted">
                {formatCAD(unit)} × {qty}
                {setupFee > 0 && <> + {formatCAD(setupFee)} setup</>}
              </div>
            </div>
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
    {latestProof?.image && (
      <ProofLightbox
        src={latestProof.image}
        kind={fileKind(latestProof.image)}
        title={`Proof: ${item.productName || "item"}`}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    )}
    </>
  );
}

/** The S&S blank this garment came from — the brand + style number Julian reorders by. */
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
