// Print-area geometry shared by the designer canvas, the review measurements,
// and the admin print-area editor, so all three always show the same box.
//
// The model: `maxWidthIn × maxHeightIn` is the physical truth (what the box IS
// on the garment). The admin-drawn normalized `position` rectangle is a
// placement ENVELOPE, it says where on the garment photo the zone sits and how
// big it may be, but its aspect ratio can disagree with the inch dimensions
// (seed data did, and admins can drag freely). Deriving inches from a
// disagreeing box would make width and height scale differently, a square
// graphic would "measure" as a rectangle.
//
// So every surface renders the EFFECTIVE box: the largest rectangle whose
// on-screen pixel aspect equals the inch aspect, contained in the envelope and
// sharing its center. That gives one uniform px-per-inch on both axes, which
// makes measurements trustworthy, and it self-corrects at runtime for whatever
// garment-photo aspect the current colour/view happens to have.

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
} // all 0..1, relative to the garment image

/**
 * The inch-true print box. `canvasAspect` is the garment image's width/height
 * (the canvas matches it, so normalized coords map 1:1 to pixels). Without
 * inch dims there is nothing to reconcile, the envelope is returned as-is.
 */
export function effectivePrintBox(
  envelope: NormalizedBox,
  maxWidthIn: number | null | undefined,
  maxHeightIn: number | null | undefined,
  canvasAspect: number
): NormalizedBox {
  if (!maxWidthIn || !maxHeightIn || maxWidthIn <= 0 || maxHeightIn <= 0 || canvasAspect <= 0) {
    return { ...envelope };
  }
  // Work in a pixel-like space: for a canvas of width A and height 1,
  // envelope px size is (width·A, height).
  const envW = envelope.width * canvasAspect;
  const envH = envelope.height;
  const target = maxWidthIn / maxHeightIn;
  let w = envW;
  let h = envH;
  if (envW / envH > target) w = envH * target; // envelope too wide, trim width
  else h = envW / target; //                      envelope too tall, trim height
  const width = w / canvasAspect;
  const height = h;
  return {
    x: envelope.x + (envelope.width - width) / 2,
    y: envelope.y + (envelope.height - height) / 2,
    width,
    height,
  };
}

/**
 * Pixels per inch inside an effective box on a canvas of `canvasWidthPx`.
 * Uniform on both axes by construction of effectivePrintBox. Null when the
 * area has no inch dimensions configured.
 */
export function boxPxPerInch(
  effectiveBox: NormalizedBox,
  maxWidthIn: number | null | undefined,
  canvasWidthPx: number
): number | null {
  if (!maxWidthIn || maxWidthIn <= 0) return null;
  const px = effectiveBox.width * canvasWidthPx;
  return px > 0 ? px / maxWidthIn : null;
}

/**
 * Which zone a piece of art belongs to, given its centre in normalized coords
 * and the effective boxes of every zone on that view (index-aligned).
 *
 * A side can carry several zones, and they routinely NEST: a left chest sits
 * inside the full front. So containment alone is ambiguous, and the smallest
 * containing zone wins. That matches how a printer reads it, a chest-sized
 * logo dropped on the chest is a left chest print, not a full front print.
 *
 * Art whose centre is in no zone still has to belong somewhere (it is flagged
 * out of bounds separately, never dropped), so it falls to the nearest zone by
 * centre distance. Returns -1 only when there are no zones at all.
 */
export function zoneIndexForPoint(cx: number, cy: number, boxes: NormalizedBox[]): number {
  if (boxes.length === 0) return -1;
  if (boxes.length === 1) return 0;

  let best = -1;
  let bestArea = Infinity;
  boxes.forEach((b, i) => {
    const inside = cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height;
    if (!inside) return;
    const area = b.width * b.height;
    if (area < bestArea) {
      bestArea = area;
      best = i;
    }
  });
  if (best !== -1) return best;

  let nearest = 0;
  let nearestDist = Infinity;
  boxes.forEach((b, i) => {
    const dx = cx - (b.x + b.width / 2);
    const dy = cy - (b.y + b.height / 2);
    const d = dx * dx + dy * dy;
    if (d < nearestDist) {
      nearestDist = d;
      nearest = i;
    }
  });
  return nearest;
}

/** `12″ × 14″`, shared label formatting so admin + designer read identically. */
export function formatInches(w: number, h: number): string {
  const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));
  return `${f(w)}″ × ${f(h)}″`;
}

/**
 * Per-size-range override of a print area's max dimensions (a Youth/XS hoodie
 * takes a smaller print than a 3XL). Stored in print_areas.size_limits;
 * admin-facing only: the designer keeps showing the one standard-size box, and
 * the artist applies the right range at proof time.
 */
export interface PrintAreaSizeLimit {
  label: string;
  maxWidthIn: number;
  maxHeightIn: number;
}

/** Read print_areas.size_limits defensively (jsonb from the wire, or absent
 *  entirely on databases where the 0016 migration hasn't run yet). */
export function parseSizeLimits(raw: unknown): PrintAreaSizeLimit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const row = (r ?? {}) as Partial<PrintAreaSizeLimit>;
      const w = Number(row.maxWidthIn);
      const h = Number(row.maxHeightIn);
      const label = typeof row.label === "string" ? row.label.trim() : "";
      if (!label || !Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) return null;
      return { label, maxWidthIn: w, maxHeightIn: h };
    })
    .filter((r): r is PrintAreaSizeLimit => r !== null);
}
