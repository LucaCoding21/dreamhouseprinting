"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/use-toast";
import type { PrintAreaRow, ProductColourJson } from "@/lib/db/rows";
import { effectivePrintBox, formatInches, parseSizeLimits } from "@/lib/design/printArea";
import { savePrintAreasAction, type PrintAreaInput } from "../actions";

type Colour = ProductColourJson & { enabled?: boolean };
type View = "front" | "back" | "sleeve";

interface EditorArea {
  name: string;
  view: View;
  position: { x: number; y: number; width: number; height: number }; // normalized 0..1
  maxWidthIn: number;
  maxHeightIn: number;
  /** Per-size-range overrides, string drafts so decimals type cleanly. */
  sizeLimits: { label: string; w: string; h: string }[];
  /** Editing aid, not persisted: a locked box can't be dragged or resized,
   *  so a finished area doesn't get nudged while working on its neighbour. */
  locked?: boolean;
}

const VIEW_LABELS: Record<View, string> = { front: "Front", back: "Back", sleeve: "Sleeve" };

/** Pull the garment backdrop image for a view from the first colour that has it. */
function imageForView(colours: Colour[], view: View): string | null {
  const key = view === "sleeve" ? "side" : view;
  for (const c of colours) {
    const img = c.images?.[key as "front" | "back" | "side"];
    if (img) return img;
  }
  // Fallback to any front image.
  return colours.find((c) => c.images?.front)?.images.front ?? null;
}

export function PrintAreaEditor({
  productId,
  initialAreas,
  colours,
}: {
  productId: string;
  initialAreas: PrintAreaRow[];
  colours: Colour[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, startSave] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    idx: number;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startPos: EditorArea["position"];
    startWIn: number;
    startHIn: number;
    rect: DOMRect;
  } | null>(null);

  const availableViews = (["front", "back", "sleeve"] as View[]).filter((v) => imageForView(colours, v));
  const [view, setView] = useState<View>(availableViews[0] ?? "front");

  const [areas, setAreas] = useState<EditorArea[]>(() =>
    initialAreas.map((a) => {
      const p = (a.position ?? {}) as Partial<EditorArea["position"]>;
      return {
        name: a.name,
        view: (a.view === "left_sleeve" || a.view === "right_sleeve" ? "sleeve" : a.view) as View,
        position: { x: p.x ?? 0.35, y: p.y ?? 0.3, width: p.width ?? 0.3, height: p.height ?? 0.35 },
        maxWidthIn: a.max_width_in ?? 11,
        maxHeightIn: a.max_height_in ?? 14,
        sizeLimits: parseSizeLimits(a.size_limits).map((r) => ({
          label: r.label,
          w: String(r.maxWidthIn),
          h: String(r.maxHeightIn),
        })),
      };
    })
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  // Aspect ratio of the loaded garment image. The frame matches it so the
  // image fills with no letterbox, then % box coords and drag deltas (which
  // divide by the container rect) map 1:1 to the same basis the designer uses.
  const [imgAspect, setImgAspect] = useState(1);
  // Aspect per view, recorded as each view's image loads. Geometry that
  // reconciles a box against its inch dims must only run with the REAL aspect
  // of that view's photo, never the initial 1 or another view's number.
  const [aspects, setAspects] = useState<Partial<Record<View, number>>>({});
  const aspectFor = (v: View) => aspects[v] ?? null;

  const img = imageForView(colours, view);
  const visibleIdx = areas.map((a, i) => ({ a, i })).filter(({ a }) => a.view === view);

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }

  /**
   * Snap an area's stored box to its EFFECTIVE box (the largest rect matching
   * the inch aspect inside it, what the designer actually renders). Keeping
   * the stored box on this invariant is what makes the numbers trustworthy:
   * the box you see here, the label, and the designer's box are all the same
   * rectangle. No-op when the view's photo aspect isn't known yet.
   */
  function snapToInches(a: EditorArea): EditorArea {
    const aspect = aspectFor(a.view);
    if (!aspect) return a;
    return { ...a, position: effectivePrintBox(a.position, a.maxWidthIn, a.maxHeightIn, aspect) };
  }

  function addArea() {
    const defaultName =
      view === "front" ? (areas.some((a) => a.view === "front") ? "Left chest" : "Front center") : view === "back" ? "Full back" : "Sleeve";
    // Sleeves are a small zone; fronts/backs get the standard platen. The
    // default box is snapped to the inch aspect immediately so a brand-new
    // area is born consistent instead of ~10% off.
    const fresh: EditorArea =
      view === "sleeve"
        ? { name: defaultName, view, position: { x: 0.4, y: 0.26, width: 0.18, height: 0.15 }, maxWidthIn: 4, maxHeightIn: 3.5, sizeLimits: [] }
        : { name: defaultName, view, position: { x: 0.35, y: 0.28, width: 0.3, height: 0.34 }, maxWidthIn: 11, maxHeightIn: 14, sizeLimits: [] };
    setAreas((prev) => [...prev, snapToInches(fresh)]);
    setSelected(areas.length);
  }

  function startInteraction(e: React.PointerEvent, idx: number, mode: "move" | "resize") {
    // A locked box still selects (so its card highlights), it just won't move.
    if (areas[idx].locked) {
      setSelected(idx);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(idx);
    // Snap first so every drag starts from a box that agrees with its inches;
    // all the per-inch ratios below are only valid on that invariant.
    const snapped = snapToInches(areas[idx]);
    setAreas((prev) => prev.map((a, i) => (i === idx ? snapped : a)));
    dragRef.current = {
      idx,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...snapped.position },
      startWIn: snapped.maxWidthIn,
      startHIn: snapped.maxHeightIn,
      rect,
    };
  }

  function onMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.rect.width;
    const dy = (e.clientY - d.startY) / d.rect.height;
    setAreas((prev) => {
      const next = [...prev];
      const p = { ...d.startPos };
      const patch: Partial<EditorArea> = {};
      if (d.mode === "move") {
        p.x = clamp(d.startPos.x + dx, 0, 1 - d.startPos.width);
        p.y = clamp(d.startPos.y + dy, 0, 1 - d.startPos.height);
      } else if (d.startPos.width > 0 && d.startPos.height > 0 && d.startWIn > 0 && d.startHIn > 0) {
        // Corner resize, snapped to half-inch steps: the cursor proposes a raw
        // size, it rounds to inches, and the BOX is rebuilt from the rounded
        // inches, so the rectangle always equals its label exactly (the old
        // code rounded the label but kept the raw box, and the two drifted
        // apart a little more on every drag).
        const rawW = clamp(d.startPos.width + dx, 0.02, 1 - d.startPos.x);
        const rawH = clamp(d.startPos.height + dy, 0.02, 1 - d.startPos.y);
        const perX = d.startPos.width / d.startWIn; //  normalized units per inch
        const perY = d.startPos.height / d.startHIn;
        const half = (n: number) => Math.max(0.5, Math.round(n * 2) / 2);
        // Cap at whatever fits the photo from the box's origin, in half steps.
        const fitW = Math.floor(((1 - d.startPos.x) / perX) * 2) / 2;
        const fitH = Math.floor(((1 - d.startPos.y) / perY) * 2) / 2;
        const wIn = Math.min(half(rawW / perX), Math.max(0.5, fitW));
        const hIn = Math.min(half(rawH / perY), Math.max(0.5, fitH));
        p.width = wIn * perX;
        p.height = hIn * perY;
        patch.maxWidthIn = wIn;
        patch.maxHeightIn = hIn;
      } else {
        // No inch dims yet, plain free resize.
        p.width = clamp(d.startPos.width + dx, 0.05, 1 - d.startPos.x);
        p.height = clamp(d.startPos.height + dy, 0.05, 1 - d.startPos.y);
      }
      next[d.idx] = { ...next[d.idx], position: p, ...patch };
      return next;
    });
  }

  function endInteraction() {
    dragRef.current = null;
  }

  function updateArea(idx: number, patch: Partial<EditorArea>) {
    setAreas((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  /**
   * Typing an inch dimension resizes the box at the area's ONE uniform
   * pixels-per-inch (derived from whichever axis already has a valid scale),
   * rebuilding BOTH axes so the box, the label and the designer stay exact.
   * The old per-axis ratio silently compounded any existing box/inch mismatch,
   * which is how typing + dragging together made the numbers go wrong. If the
   * bigger box would poke past the photo's edge it slides back into frame
   * instead of being clamped smaller than what was typed.
   */
  function setInch(idx: number, dim: "w" | "h", value: number) {
    setAreas((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const wIn = dim === "w" ? value : a.maxWidthIn;
        const hIn = dim === "h" ? value : a.maxHeightIn;
        let position = { ...a.position };
        const aspect = aspectFor(a.view);
        if (value > 0 && wIn > 0 && hIn > 0 && aspect) {
          // Uniform px-per-inch in height-normalized pixel space (canvas is
          // aspect wide x 1 tall): u = px per inch. Prefer the width axis's
          // existing scale, fall back to height.
          const u =
            a.maxWidthIn > 0 && a.position.width > 0
              ? (a.position.width * aspect) / a.maxWidthIn
              : a.maxHeightIn > 0 && a.position.height > 0
                ? a.position.height / a.maxHeightIn
                : 0;
          if (u > 0) {
            const width = Math.min(1, (wIn * u) / aspect);
            const height = Math.min(1, hIn * u);
            position = {
              x: clamp(position.x, 0, 1 - width),
              y: clamp(position.y, 0, 1 - height),
              width,
              height,
            };
          }
        }
        return { ...a, maxWidthIn: wIn, maxHeightIn: hIn, position };
      })
    );
  }

  function removeArea(idx: number) {
    setAreas((prev) => prev.filter((_, i) => i !== idx));
    setSelected(null);
  }

  function save() {
    startSave(async () => {
      // Snap every area whose photo aspect is known, so what lands in the DB
      // is always the box that was on screen (views never opened keep their
      // stored box untouched rather than being reconciled at a guessed aspect).
      const payload: PrintAreaInput[] = areas.map(snapToInches).map((a, i) => ({
        name: a.name,
        view: a.view === "sleeve" ? "left_sleeve" : a.view,
        position: a.position,
        maxWidthIn: a.maxWidthIn,
        maxHeightIn: a.maxHeightIn,
        pxPerInch: 0, // designer derives scale from the box + image; not needed here
        displayOrder: i,
        sizeLimits: a.sizeLimits.map((r) => ({
          label: r.label,
          maxWidthIn: Number(r.w) || 0,
          maxHeightIn: Number(r.h) || 0,
        })),
      }));
      const res = await savePrintAreasAction(productId, payload);
      if (res.error) toast({ title: "Save failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Print areas saved", variant: "success" });
        router.refresh();
      }
    });
  }

  return (
    <>
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CardTitle>Print areas</CardTitle>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="How print areas work"
            className="grid h-5 w-5 place-items-center rounded-full border border-dream-line text-xs font-bold text-dream-muted transition-colors hover:border-dream-purple hover:text-dream-purple"
          >
            ?
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={addArea}>
            + Add area
          </Button>
          <Button variant="primary" size="sm" onClick={save} loading={saving}>
            Save areas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-dream-muted">
          Drag to move, drag the corner to resize. Inch sizes update as you go.
        </p>

        {availableViews.length > 1 && (
          <div className="mb-3 flex gap-1">
            {availableViews.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  v === view ? "bg-dream-purple text-white" : "bg-dream-bg text-dream-muted hover:text-dream-ink"
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
        )}

        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
          {/* The bordered panel fills its column so the layout uses the space;
              the image (and the % coordinate system the boxes live in) stays
              capped and centered inside it. */}
          <div className="w-full rounded-xl border border-dream-line bg-white p-4">
          <div
            ref={containerRef}
            className="relative mx-auto w-full max-w-[420px] select-none"
            style={{ aspectRatio: img ? imgAspect : 1 }}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${view}:${img}`}
                src={img}
                alt={view}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  if (el.naturalWidth && el.naturalHeight) {
                    const ratio = el.naturalWidth / el.naturalHeight;
                    setImgAspect(ratio);
                    setAspects((s) => ({ ...s, [view]: ratio }));
                  }
                }}
                className="pointer-events-none h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-dream-muted">No image for this view</div>
            )}
            {visibleIdx.map(({ a, i }) => {
              // Draw the EFFECTIVE box, exactly what the designer renders, so
              // any legacy row whose stored box disagrees with its inches shows
              // the truth here too (mutations snap the stored box to this).
              const box = aspectFor(a.view)
                ? effectivePrintBox(a.position, a.maxWidthIn, a.maxHeightIn, aspectFor(a.view)!)
                : a.position;
              return (
              <div
                key={i}
                onPointerDown={(e) => startInteraction(e, i, "move")}
                onPointerMove={onMove}
                onPointerUp={endInteraction}
                onPointerCancel={endInteraction}
                className={cn(
                  "absolute rounded-sm border-2",
                  a.locked ? "cursor-default border-dashed" : "cursor-move",
                  selected === i ? "border-dream-purple bg-dream-purple/15" : "border-dream-purple/60 bg-dream-purple/5"
                )}
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                }}
              >
                {/* Label sits INSIDE its own box: labels above the boxes crashed
                    into each other the moment two zones sat side by side, and
                    clipped at the canvas top. Selected shows the full spec,
                    the rest just their name. */}
                <span
                  className={cn(
                    "absolute left-0.5 top-0.5 max-w-[calc(100%-4px)] truncate whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white",
                    selected === i ? "bg-dream-purple" : "bg-dream-purple/60"
                  )}
                >
                  {a.locked && <LockIcon locked className="mr-0.5 inline-block h-2.5 w-2.5 align-[-1px]" />}
                  {a.name}
                  {selected === i &&
                    a.maxWidthIn > 0 &&
                    a.maxHeightIn > 0 &&
                    ` · ${formatInches(a.maxWidthIn, a.maxHeightIn)}`}
                </span>
                {!a.locked && (
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      startInteraction(e, i, "resize");
                    }}
                    onPointerMove={onMove}
                    onPointerUp={endInteraction}
                    onPointerCancel={endInteraction}
                    className="absolute bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-full border border-white bg-dream-purple"
                  />
                )}
              </div>
              );
            })}
          </div>
          </div>

          {/* Area list */}
          <div className="space-y-3">
            {visibleIdx.length === 0 && (
              <p className="text-sm text-dream-muted">No print areas on this view yet. Click “Add area”.</p>
            )}
            {visibleIdx.map(({ a, i }) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-3",
                  selected === i ? "border-dream-purple" : "border-dream-line"
                )}
                onClick={() => setSelected(i)}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    value={a.name}
                    onChange={(e) => updateArea(i, { name: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <button
                    type="button"
                    aria-pressed={!!a.locked}
                    title={a.locked ? "Unlock, allow dragging this box again" : "Lock this box so it can't be dragged by accident"}
                    onClick={() => updateArea(i, { locked: !a.locked })}
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors",
                      a.locked
                        ? "border-dream-purple bg-dream-lavender-soft text-dream-purple"
                        : "border-dream-line text-dream-faint hover:border-dream-purple hover:text-dream-purple"
                    )}
                  >
                    <LockIcon locked={!!a.locked} />
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => removeArea(i)}>
                    Delete
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-dream-muted">
                    Max width (in)
                    <InchInput value={a.maxWidthIn} onChange={(n) => setInch(i, "w", n)} />
                  </label>
                  <label className="text-xs text-dream-muted">
                    Max height (in)
                    <InchInput value={a.maxHeightIn} onChange={(n) => setInch(i, "h", n)} />
                  </label>
                </div>

                {/* Per-size overrides: the box above is the standard adult
                    size; these record what smaller / bigger garments really
                    take. Admin-facing only, surfaced on the order detail. */}
                <div className="mt-3 border-t border-dream-line pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-dream-muted">
                      Limits by garment size
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-dream-purple hover:underline"
                      onClick={() =>
                        updateArea(i, {
                          sizeLimits: [...a.sizeLimits, { label: "", w: "", h: "" }],
                        })
                      }
                    >
                      + Add size range
                    </button>
                  </div>
                  {a.sizeLimits.length === 0 ? (
                    <p className="mt-1 text-[11px] text-dream-faint">
                      Optional. Add rows when smaller or bigger garments print differently,
                      e.g. Youth/XS at 9 x 12. Shown to you on orders, not to customers.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {a.sizeLimits.map((row, ri) => {
                        const patchRow = (patch: Partial<typeof row>) =>
                          updateArea(i, {
                            sizeLimits: a.sizeLimits.map((r, j) => (j === ri ? { ...r, ...patch } : r)),
                          });
                        return (
                          <div key={ri} className="flex items-center gap-1.5">
                            <Input
                              value={row.label}
                              placeholder="e.g. Youth/XS"
                              onChange={(e) => patchRow({ label: e.target.value })}
                              className="h-8 min-w-0 flex-1 text-xs"
                            />
                            <Input
                              value={row.w}
                              inputMode="decimal"
                              placeholder="W"
                              title="Max width in inches for this size range"
                              onChange={(e) => !/[^0-9.]/.test(e.target.value) && patchRow({ w: e.target.value })}
                              className="h-8 w-14 shrink-0 px-1 text-center text-xs"
                            />
                            <span className="text-[10px] text-dream-faint">x</span>
                            <Input
                              value={row.h}
                              inputMode="decimal"
                              placeholder="H"
                              title="Max height in inches for this size range"
                              onChange={(e) => !/[^0-9.]/.test(e.target.value) && patchRow({ h: e.target.value })}
                              className="h-8 w-14 shrink-0 px-1 text-center text-xs"
                            />
                            <span className="text-[10px] text-dream-faint">in</span>
                            <button
                              type="button"
                              aria-label="Remove size range"
                              className="shrink-0 rounded p-1 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
                              onClick={() =>
                                updateArea(i, { sizeLimits: a.sizeLimits.filter((_, j) => j !== ri) })
                              }
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>

    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="max-w-md">
        <DialogHeader className="px-6 pt-6 pb-1">
          <DialogTitle>How print areas work</DialogTitle>
          <DialogDescription className="pt-1 leading-relaxed">
            Each box is a printable zone on the garment. Drag it to reposition, or drag the corner
            handle to resize it in any direction. As you resize, the width and height in inches update
            automatically, and you can fine-tune them in the fields below (typing a size resizes the box
            to match).
            <br />
            <br />
            What you draw here is what customers see in the designer and print against. Boxes stay
            aligned across every colour and follow the selected view. A product needs at least one print
            area before it can open in the designer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end px-6 pb-6 pt-3">
          <button
            onClick={() => setShowHelp(false)}
            className="rounded-full bg-dream-purple px-5 py-2 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

/** Padlock, closed or open, for the per-area drag lock. */
function LockIcon({ locked, className }: { locked: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? "h-3.5 w-3.5"}
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      {locked ? <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /> : <path d="M8 10.5V7a4 4 0 0 1 7.8-1.3" />}
    </svg>
  );
}

/**
 * Number field that edits through a string draft so decimals type cleanly, no
 * stuck leading zero (the controlled `type=number` bug) and you can clear it
 * mid-edit. Syncs from the external number only while unfocused (e.g. when a
 * drag changes the size). Blank/invalid entries don't propagate.
 */
function InchInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState(() => (value ? String(value) : ""));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value ? String(value) : "");
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setDraft(value ? String(value) : "");
      }}
      onChange={(e) => {
        const s = e.target.value;
        if (/[^0-9.]/.test(s)) return; // digits and one decimal point only
        setDraft(s);
        const n = Number(s);
        if (s.trim() !== "" && !Number.isNaN(n)) onChange(n);
      }}
      className="mt-1 h-8"
    />
  );
}
