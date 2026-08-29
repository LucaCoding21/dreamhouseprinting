"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { formatCAD } from "@/lib/money";
import { formatInches } from "@/lib/design/printArea";
import { LINE_PRODUCTION_META } from "@/lib/lineProduction";
import { ReorderArrows } from "./ReorderArrows";
import { ProofLightbox, fileKind } from "./ProofLightbox";
import { itemQty, type ItemState, type OrderProduct } from "./shared";
import type { DecorationSpot } from "../actions";
import type { DesignRow, ProofRow } from "@/lib/db/rows";
import { customerCanSeeProof } from "@/lib/orders/proofVisibility";

/**
 * One print spot as a single readable clause: "Front center · Screen print ·
 * 12″ × 10″ · 2 col". Empty parts drop out, so a spot that is only half filled
 * in still reads cleanly instead of showing a row of orphan separators.
 */
function spotLabel(sp: DecorationSpot): string {
  const w = parseFloat(sp.widthIn);
  const h = parseFloat(sp.heightIn);
  const size = w > 0 && h > 0 ? formatInches(w, h) : "";
  const colours = sp.colours.trim();
  return [sp.location.trim() || "Print", sp.type.trim(), size, colours ? `${colours} col` : ""]
    .filter(Boolean)
    .join(" · ");
}

/** One-line summary of an item, used both by the global Compact view and per-line collapse. */
export function CompactItemRow({
  it,
  index,
  product,
  design,
  proofsForItem,
  orderNumber,
  orderStatus,
  setupFee,
  onExpand,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  it: ItemState;
  index: number;
  product: OrderProduct | undefined;
  design: DesignRow | undefined;
  /** Proofs filed against this line, newest first (see getAdminOrder). */
  proofsForItem: ProofRow[];
  /** For download filenames and the "customer can't see this yet" hint. */
  orderNumber?: string | null;
  orderStatus?: string;
  setupFee: number;
  /** When set, shows a chevron to expand this line back to the detailed card. */
  onExpand?: () => void;
  /** When set, shows the delete X. Omitted when the viewer cannot edit. */
  onRemove?: () => void;
  /** Move this line up/down the queue. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const mockup = ((design?.mockup_images ?? []) as { url: string | null }[]).find((m) => m.url)?.url ?? null;
  // Once a proof exists it IS what is getting printed, so it replaces the
  // customer's own mockup here exactly as it does on the detailed card.
  // Julian: "the photo is still the original photo not the PDF mock up".
  const proofRow = proofsForItem.find((p) => p.image) ?? null;
  const proof = proofRow?.image ?? null;
  const thumb = proof ?? mockup;
  // The admin sees the proof here, but the customer page still shows the
  // mockup until the order is sent for approval. Say so, or "the photo is
  // still the original photo" comes back as a bug report.
  const hiddenFromCustomer = !!proofRow && !!orderStatus && !customerCanSeeProof(proofRow.status, orderStatus);
  const fileStem = [orderNumber ? `order-${orderNumber}` : null, it.productName, proof ? "proof" : "mockup"]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const thumbKind = proof ? fileKind(proof) : "image";
  const qty = itemQty(it);
  const unit = Number(it.unitPrice) || 0;
  const sizeSummary = it.sizes.filter(([, q]) => q > 0).map(([s, q]) => `${s}×${q}`).join("  ") || "-";
  const prints = it.spots.map(spotLabel).filter(Boolean).join("  |  ");

  return (
    // Phone: the row wraps into two lines (identity on top, money underneath).
    // Everything except the name is fixed width, so a single line clips the
    // price off the side of a 375px screen. From sm up it stays one line.
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
      {onMoveUp && onMoveDown && (
        <ReorderArrows onUp={onMoveUp} onDown={onMoveDown} disableUp={!!isFirst} disableDown={!!isLast} />
      )}
      {onExpand ? (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand line"
          title="Expand line"
          className="shrink-0 rounded p-1 text-dream-faint transition-colors hover:bg-dream-bg hover:text-dream-ink max-sm:p-2.5"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <span className="w-5 text-sm text-dream-faint">{index + 1}.</span>
      {thumb ? (
        <button
          type="button"
          onClick={() => setPreview(true)}
          title={
            hiddenFromCustomer
              ? "Latest proof. Not on the customer's page yet, send the order for approval to show it."
              : proof
                ? "Latest proof, click to view full size"
                : "Mockup, click to view full size"
          }
          // A purple edge is the same cue the detailed card uses for "this is
          // the proof, not the customer's mockup".
          className={`relative h-10 w-10 shrink-0 overflow-hidden rounded border bg-dream-bg ${
            proof ? "border-dream-purple/60" : "border-transparent"
          }`}
        >
          {hiddenFromCustomer && (
            <span
              aria-label="Not visible to the customer yet"
              className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-dream-sun ring-1 ring-white"
            />
          )}
          {thumbKind === "pdf" ? (
            <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-dream-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <span className="text-[8px] font-bold leading-none">PDF</span>
            </span>
          ) : (
            <Image src={thumb} alt="" width={40} height={40} className="h-full w-full object-contain" />
          )}
        </button>
      ) : (
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-dream-bg" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-dream-ink">{it.productName || "Untitled item"}</div>
        <div className="truncate text-xs text-dream-muted">
          {product?.ss_style_name && (
            <span className="font-semibold text-dream-ink">
              {product.brand ? `${product.brand} ${product.ss_style_name}` : product.ss_style_name}
              <span className="mx-1.5 text-dream-faint">·</span>
            </span>
          )}
          {sizeSummary}
          {design?.name && (
            <>
              <span className="mx-1.5 text-dream-faint">·</span>
              &ldquo;{design.name}&rdquo;
            </>
          )}
          {it.supplier && (
            <>
              <span className="mx-1.5 text-dream-faint">·</span>
              {it.supplier}
            </>
          )}
        </div>
        {/* What is actually getting printed. The compact row had spare width
            doing nothing, and this is the line Julian scans for. One line from
            sm up (the row stays a row), wrapping on phones where it has room. */}
        {prints && (
          <div className="text-xs text-dream-faint sm:truncate" title={prints}>
            {prints}
          </div>
        )}
      </div>
      {/* Second line on phones. `sm:contents` dissolves this wrapper from sm up,
          so the badges and price stay direct children of the row as before. */}
      <div className="flex basis-full items-center gap-3 sm:contents">
        {it.fulfilled && (
          <Badge variant="success" className="shrink-0">
            Fulfilled
          </Badge>
        )}
        <Badge variant={LINE_PRODUCTION_META[it.productionStatus].badge} className="shrink-0">
          {LINE_PRODUCTION_META[it.productionStatus].label}
        </Badge>
        <div className="ml-auto shrink-0 text-right text-sm sm:ml-0">
          <div className="text-dream-muted">
            {qty} × {formatCAD(unit)}
          </div>
          <div className="font-semibold text-dream-ink">{formatCAD(unit * qty + setupFee)}</div>
        </div>
        {/* Delete lives on every row, not just the expanded card: collapsing a
            line (or switching to Compact view) used to hide the only X there
            was, which is why removing a line felt impossible. */}
        {onRemove && (
          <button
            type="button"
            aria-label="Remove item"
            title="Remove this item"
            onClick={onRemove}
            className="shrink-0 rounded p-1 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger max-sm:p-2.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      {thumb && (
        <ProofLightbox
          src={thumb}
          kind={thumbKind}
          title={[orderNumber ? `Order #${orderNumber}` : null, it.productName || "item", proof ? "Proof" : "Mockup"]
            .filter(Boolean)
            .join(" · ")}
          fileStem={fileStem}
          open={preview}
          onOpenChange={setPreview}
        />
      )}
    </div>
  );
}
