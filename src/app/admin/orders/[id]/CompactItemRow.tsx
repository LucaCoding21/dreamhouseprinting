"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { formatCAD } from "@/lib/money";
import { LINE_PRODUCTION_META } from "@/lib/lineProduction";
import { ReorderArrows } from "./ReorderArrows";
import { itemQty, type ItemState, type OrderProduct } from "./shared";
import type { DesignRow } from "@/lib/db/rows";

/** One-line summary of an item, used both by the global Compact view and per-line collapse. */
export function CompactItemRow({
  it,
  index,
  product,
  design,
  setupFee,
  onExpand,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  it: ItemState;
  index: number;
  product: OrderProduct | undefined;
  design: DesignRow | undefined;
  setupFee: number;
  /** When set, shows a chevron to expand this line back to the detailed card. */
  onExpand?: () => void;
  /** Move this line up/down the queue. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const thumb = ((design?.mockup_images ?? []) as { url: string | null }[]).find((m) => m.url)?.url ?? null;
  const qty = itemQty(it);
  const unit = Number(it.unitPrice) || 0;
  const sizeSummary = it.sizes.filter(([, q]) => q > 0).map(([s, q]) => `${s}×${q}`).join("  ") || "-";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {onMoveUp && onMoveDown && (
        <ReorderArrows onUp={onMoveUp} onDown={onMoveDown} disableUp={!!isFirst} disableDown={!!isLast} />
      )}
      {onExpand ? (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand line"
          title="Expand line"
          className="shrink-0 rounded p-1 text-dream-faint transition-colors hover:bg-dream-bg hover:text-dream-ink"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <span className="w-5 text-sm text-dream-faint">{index + 1}.</span>
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-dream-bg">
        {thumb && <Image src={thumb} alt="" width={40} height={40} className="h-full w-full object-contain" />}
      </div>
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
          {it.supplier && (
            <>
              <span className="mx-1.5 text-dream-faint">·</span>
              {it.supplier}
            </>
          )}
        </div>
      </div>
      {it.fulfilled && (
        <Badge variant="success" className="shrink-0">
          Fulfilled
        </Badge>
      )}
      <Badge variant={LINE_PRODUCTION_META[it.productionStatus].badge} className="shrink-0">
        {LINE_PRODUCTION_META[it.productionStatus].label}
      </Badge>
      <div className="shrink-0 text-right text-sm">
        <div className="text-dream-muted">
          {qty} × {formatCAD(unit)}
        </div>
        <div className="font-semibold text-dream-ink">{formatCAD(unit * qty + setupFee)}</div>
      </div>
    </div>
  );
}
