"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/use-toast";
import type { PrintAreaRow, ProductColourJson } from "@/lib/db/rows";
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
    dragRef.current = { idx, mode, startX: e.clientX, startY: e.clientY, startPos: { ...areas[idx].position }, rect };
  }

  function onMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.rect.width;
    const dy = (e.clientY - d.startY) / d.rect.height;
    setAreas((prev) => {
      const next = [...prev];
      const p = { ...d.startPos };
      if (d.mode === "move") {
        p.x = clamp(d.startPos.x + dx, 0, 1 - d.startPos.width);
        p.y = clamp(d.startPos.y + dy, 0, 1 - d.startPos.height);
      } else {
        p.width = clamp(d.startPos.width + dx, 0.05, 1 - d.startPos.x);
        p.height = clamp(d.startPos.height + dy, 0.05, 1 - d.startPos.y);
      }
      next[d.idx] = { ...next[d.idx], position: p };
      return next;
    });
  }

  function endInteraction() {
    dragRef.current = null;
  }

  function updateArea(idx: number, patch: Partial<EditorArea>) {
    setAreas((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
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
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Print areas</CardTitle>
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
          Draw the printable zones on the garment. Boxes stay aligned across colours and follow the view. A product
          needs at least one print area to open in the designer.
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
            className="relative aspect-square w-full select-none overflow-hidden rounded-xl border border-dream-line bg-dream-bg"
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={view} className="pointer-events-none h-full w-full object-contain" draggable={false} />
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
                    <Input
                      type="number"
                      value={a.maxWidthIn}
                      onChange={(e) => updateArea(i, { maxWidthIn: Number(e.target.value) })}
                      className="mt-1 h-8"
                    />
                  </label>
                  <label className="text-xs text-dream-muted">
                    Max height (in)
                    <Input
                      type="number"
                      value={a.maxHeightIn}
                      onChange={(e) => updateArea(i, { maxHeightIn: Number(e.target.value) })}
                      className="mt-1 h-8"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
