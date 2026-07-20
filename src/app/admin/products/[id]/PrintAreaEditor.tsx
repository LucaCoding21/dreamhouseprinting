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
import { formatInches } from "@/lib/design/printArea";
import { savePrintAreasAction, type PrintAreaInput } from "../actions";

type Colour = ProductColourJson & { enabled?: boolean };
type View = "front" | "back" | "sleeve";

interface EditorArea {
  name: string;
  view: View;
  position: { x: number; y: number; width: number; height: number }; // normalized 0..1
  maxWidthIn: number;
  maxHeightIn: number;
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
      };
    })
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  // Aspect ratio of the loaded garment image. The frame matches it so the
  // image fills with no letterbox, then % box coords and drag deltas (which
  // divide by the container rect) map 1:1 to the same basis the designer uses.
  const [imgAspect, setImgAspect] = useState(1);

  const img = imageForView(colours, view);
  const visibleIdx = areas.map((a, i) => ({ a, i })).filter(({ a }) => a.view === view);

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }

  function addArea() {
    const defaultName =
      view === "front" ? (areas.some((a) => a.view === "front") ? "Left chest" : "Front center") : view === "back" ? "Full back" : "Sleeve";
    setAreas((prev) => [
      ...prev,
      { name: defaultName, view, position: { x: 0.35, y: 0.28, width: 0.3, height: 0.34 }, maxWidthIn: 11, maxHeightIn: 14 },
    ]);
    setSelected(areas.length);
  }

  function startInteraction(e: React.PointerEvent, idx: number, mode: "move" | "resize") {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(idx);
    dragRef.current = {
      idx,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...areas[idx].position },
      startWIn: areas[idx].maxWidthIn,
      startHIn: areas[idx].maxHeightIn,
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
      } else {
        // Free corner resize: width follows horizontal drag, height follows
        // vertical drag, both at once. The inch dims scale with each axis so the
        // numbers track the box. Rounded to the nearest half-inch.
        p.width = clamp(d.startPos.width + dx, 0.05, 1 - d.startPos.x);
        p.height = clamp(d.startPos.height + dy, 0.05, 1 - d.startPos.y);
        if (d.startPos.width > 0 && d.startPos.height > 0 && d.startWIn > 0 && d.startHIn > 0) {
          const round = (n: number) => Math.max(0.5, Math.round(n * 2) / 2);
          patch.maxWidthIn = round((p.width / d.startPos.width) * d.startWIn);
          patch.maxHeightIn = round((p.height / d.startPos.height) * d.startHIn);
        }
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

  /** Typing an inch dimension resizes the box on that axis at the same
   *  pixels-per-inch, so the box on the photo keeps matching the numbers. */
  function setInch(idx: number, dim: "w" | "h", value: number) {
    setAreas((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const position = { ...a.position };
        if (value > 0) {
          if (dim === "w" && a.maxWidthIn > 0) {
            position.width = clamp(value * (a.position.width / a.maxWidthIn), 0.05, 1 - position.x);
          } else if (dim === "h" && a.maxHeightIn > 0) {
            position.height = clamp(value * (a.position.height / a.maxHeightIn), 0.05, 1 - position.y);
          }
        }
        return { ...a, [dim === "w" ? "maxWidthIn" : "maxHeightIn"]: value, position };
      })
    );
  }

  function removeArea(idx: number) {
    setAreas((prev) => prev.filter((_, i) => i !== idx));
    setSelected(null);
  }

  function save() {
    startSave(async () => {
      const payload: PrintAreaInput[] = areas.map((a, i) => ({
        name: a.name,
        view: a.view === "sleeve" ? "left_sleeve" : a.view,
        position: a.position,
        maxWidthIn: a.maxWidthIn,
        maxHeightIn: a.maxHeightIn,
        pxPerInch: 0, // designer derives scale from the box + image; not needed here
        displayOrder: i,
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

        <div className="grid gap-4 md:grid-cols-2">
          {/* Canvas */}
          <div
            ref={containerRef}
            className="relative mx-auto w-full max-w-[420px] select-none overflow-hidden rounded-xl border border-dream-line bg-dream-bg"
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
                  if (el.naturalWidth && el.naturalHeight)
                    setImgAspect(el.naturalWidth / el.naturalHeight);
                }}
                className="pointer-events-none h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-dream-muted">No image for this view</div>
            )}
            {visibleIdx.map(({ a, i }) => (
              <div
                key={i}
                onPointerDown={(e) => startInteraction(e, i, "move")}
                onPointerMove={onMove}
                onPointerUp={endInteraction}
                className={cn(
                  "absolute cursor-move rounded-sm border-2",
                  selected === i ? "border-dream-purple bg-dream-purple/15" : "border-dream-purple/60 bg-dream-purple/5"
                )}
                style={{
                  left: `${a.position.x * 100}%`,
                  top: `${a.position.y * 100}%`,
                  width: `${a.position.width * 100}%`,
                  height: `${a.position.height * 100}%`,
                }}
              >
                <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-dream-purple px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {a.name}
                  {a.maxWidthIn > 0 && a.maxHeightIn > 0 && ` · ${formatInches(a.maxWidthIn, a.maxHeightIn)}`}
                </span>
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startInteraction(e, i, "resize");
                  }}
                  onPointerMove={onMove}
                  onPointerUp={endInteraction}
                  className="absolute bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-full border border-white bg-dream-purple"
                />
              </div>
            ))}
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
