"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as fabric from "fabric";
import { effectivePrintBox, boxPxPerInch, formatInches, type NormalizedBox } from "@/lib/design/printArea";

export type PrintBox = NormalizedBox; // normalized 0..1

/** Everything the canvas needs to draw + label + measure one print area. */
export interface PrintAreaSpec {
  box: PrintBox; // admin-drawn placement envelope
  name: string;
  maxWidthIn: number | null;
  maxHeightIn: number | null;
}

/** Physical size of the art as placed, in inches (uniform px-per-inch inside
 *  the effective print box). Null when the area has no inch dims configured. */
export interface ArtMetrics {
  widthIn: number;
  heightIn: number;
}

/** What's on the canvas, for colour analysis: text fills are known exactly,
 *  images are analyzed from their source. */
export type ArtDescriptor = { type: "text"; fill: string } | { type: "image"; src: string };

export interface DesignCanvasHandle {
  setGarment: (url: string | null) => void;
  setPrintArea: (area: PrintAreaSpec | null) => void;
  addImageFromUrl: (url: string) => Promise<void>;
  addText: (text: string, opts?: { fontFamily?: string; fontWeight?: number | string; fill?: string }) => void;
  clearArt: () => void;
  deleteActive: () => void;
  isEditingText: () => boolean;
  duplicateActive: () => Promise<void>;
  flipActive: (axis: "h" | "v") => void;
  centerActiveInPrintArea: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  setActiveColor: (hex: string) => void;
  setActiveFont: (fontFamily: string, fontWeight?: number | string) => void;
  renderAll: () => void;
  exportScene: () => object;
  loadScene: (json: object | null) => Promise<void>;
  exportMockup: () => string | null;
  hasObjects: () => boolean;
  artOutsidePrintArea: () => boolean;
  artMetrics: () => ArtMetrics | null;
  getArtDescriptors: () => ArtDescriptor[];
  recalcOffset: () => void;
}

// The canvas sizes itself to the garment image's aspect ratio (within this
// envelope) so the garment FILLS the frame with no letterboxing. That makes
// normalized 0..1 print-area coords map 1:1 to canvas pixels — the same basis
// the admin PrintAreaEditor uses — so the print box lines up exactly across
// colours and views. (Previously a fixed 520² square letterboxed the garment,
// so the box drifted on any non-square image.)
const MAX_W = 520;
const MAX_H = 600;
const DEFAULT_DIMS = { w: 480, h: 560 };

/**
 * Marker stamped on the print-guide rect + label so they can be recognised by
 * VALUE, not just by ref. Fabric's loadFromJSON clears the canvas and re-adds
 * objects, and stack-order helpers like bringObjectToFront blindly push an
 * object back into `_objects` even if it was just removed, so a guide can be
 * resurrected while the refs no longer track it. Every guide-aware code path
 * (export, measurement, hasObjects) must treat tagged orphans as guides too.
 */
const GUIDE_TAG = "dhGuide" as const;

function isGuideObject(o: fabric.FabricObject): boolean {
  return (o as unknown as Record<string, unknown>)[GUIDE_TAG] === true;
}

function fitDims(imgW: number, imgH: number) {
  const aspect = imgW / imgH || DEFAULT_DIMS.w / DEFAULT_DIMS.h;
  let w = MAX_W;
  let h = Math.round(w / aspect);
  if (h > MAX_H) {
    h = MAX_H;
    w = Math.round(h * aspect);
  }
  return { w, h };
}

/**
 * Ensure a web font is downloaded before Fabric measures/renders text with it —
 * canvas draws with whatever's loaded at paint time, so an un-loaded font
 * silently falls back. `fontFamily` may be a comma list; we load the first face.
 */
async function ensureFont(fontFamily: string, fontWeight: number | string = 400) {
  try {
    if (typeof document === "undefined" || !document.fonts?.load) return;
    const first = fontFamily.split(",")[0].trim();
    const quoted = /^['"]/.test(first) ? first : JSON.stringify(first);
    await document.fonts.load(`${fontWeight} 40px ${quoted}`);
  } catch {
    /* fall back to the default face */
  }
}

export const DesignCanvas = forwardRef<
  DesignCanvasHandle,
  {
    onSelectionChange?: (hasSelection: boolean, isText?: boolean) => void;
    onChange?: () => void;
    onGarmentLoaded?: () => void;
    /** Invoked when the on-canvas delete badge is clicked. The parent removes
     *  the active object (so the delete goes through the undo history). */
    onRequestDelete?: () => void;
  }
>(function DesignCanvas({ onSelectionChange, onChange, onGarmentLoaded, onRequestDelete }, ref) {
  const elRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const printRectRef = useRef<fabric.Rect | null>(null);
  const printLabelRef = useRef<fabric.FabricText | null>(null);
  const printAreaRef = useRef<PrintAreaSpec | null>(null);
  // The inch-true box actually drawn/measured against (see lib/design/printArea).
  const effBoxRef = useRef<PrintBox | null>(null);
  const dimsRef = useRef({ ...DEFAULT_DIMS });
  // Monotonic token per setGarment call: a slow image load that finishes
  // after a newer call must not stomp the newer garment (out-of-order swaps).
  const garmentSeqRef = useRef(0);
  // Scene loads are serialized: two overlapping loadFromJSON calls interleave
  // their clear/add/redraw steps and corrupt the canvas (orphaned guides,
  // wrong scene winning). Each load chains onto the previous one.
  const loadChainRef = useRef<Promise<void>>(Promise.resolve());
  // A round X badge pinned to each object's top-right corner. Created once the
  // canvas mounts and attached to every art object so delete is always in reach.
  const deleteControlRef = useRef<fabric.Control | null>(null);
  // Latest delete callback, read by the (stable) control handler.
  const onDeleteRef = useRef(onRequestDelete);
  onDeleteRef.current = onRequestDelete;

  useEffect(() => {
    if (!elRef.current) return;
    // Brand the selection controls: a purple outline with white, purple-ringed
    // round handles, instead of Fabric's default light-blue square boxes. Set
    // on the shared object defaults so every text/image object picks it up.
    fabric.InteractiveFabricObject.ownDefaults = {
      ...fabric.InteractiveFabricObject.ownDefaults,
      borderColor: "#7664ff",
      borderScaleFactor: 1.5,
      cornerColor: "#ffffff",
      cornerStrokeColor: "#7664ff",
      cornerStyle: "circle",
      cornerSize: 11,
      transparentCorners: false,
      padding: 4,
    };
    // The delete badge: a white circle ringed in purple with an X, sitting just
    // off the top-right handle. Clicking it asks the parent to delete (so the
    // removal is snapshotted for undo).
    deleteControlRef.current = new fabric.Control({
      x: 0.5,
      y: -0.5,
      offsetX: 14,
      offsetY: -14,
      cursorStyle: "pointer",
      mouseUpHandler: () => {
        onDeleteRef.current?.();
        return true;
      },
      render: (ctx, left, top) => {
        const r = 11;
        ctx.save();
        ctx.beginPath();
        ctx.arc(left, top, r, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#7664ff";
        ctx.stroke();
        const a = 4;
        ctx.strokeStyle = "#7664ff";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(left - a, top - a);
        ctx.lineTo(left + a, top + a);
        ctx.moveTo(left + a, top - a);
        ctx.lineTo(left - a, top + a);
        ctx.stroke();
        ctx.restore();
      },
    });

    const canvas = new fabric.Canvas(elRef.current, {
      width: dimsRef.current.w,
      height: dimsRef.current.h,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });
    canvasRef.current = canvas;

    const emitSel = () => {
      const o = canvas.getActiveObject();
      onSelectionChange?.(!!o, o?.type === "i-text");
    };
    canvas.on("selection:created", emitSel);
    canvas.on("selection:updated", emitSel);
    canvas.on("selection:cleared", () => onSelectionChange?.(false));
    canvas.on("object:modified", () => onChange?.());
    canvas.on("object:added", (e) => {
      // Keep the print-area label readable above newly added art. Only reorder
      // a label that is STILL on the canvas: bringObjectToFront pushes its
      // argument into the object stack unconditionally, so calling it with a
      // label that loadFromJSON's clear() just removed would resurrect it as
      // an untracked orphan (which then bakes into exported mockups).
      const label = printLabelRef.current;
      if (label && e.target !== label && canvas.getObjects().includes(label)) {
        canvas.bringObjectToFront(label);
      }
      onChange?.();
    });
    canvas.on("object:removed", () => onChange?.());

    return () => {
      canvas.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Give an art object the top-right delete badge (in addition to its resize
   *  handles). Not applied to the print guide, which is non-interactive. */
  function attachControls(obj: fabric.FabricObject) {
    if (deleteControlRef.current) {
      obj.controls = { ...obj.controls, deleteControl: deleteControlRef.current };
    }
  }

  function redrawPrintRect() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Sweep EVERY guide off the canvas, the tracked pair AND any tag-marked
    // orphan a scene load may have left behind, before drawing fresh ones.
    canvas
      .getObjects()
      .filter((o) => isGuideObject(o) || o === printRectRef.current || o === printLabelRef.current)
      .forEach((o) => canvas.remove(o));
    printRectRef.current = null;
    printLabelRef.current = null;
    const area = printAreaRef.current;
    if (!area) {
      effBoxRef.current = null;
      canvas.requestRenderAll();
      return;
    }
    const { w, h } = dimsRef.current;
    // Reconcile the drawn envelope with the physical inch dims: the box we
    // render (and measure inside) is the largest inch-aspect-true rect that
    // fits the envelope, so px-per-inch is uniform on both axes.
    const box = effectivePrintBox(area.box, area.maxWidthIn, area.maxHeightIn, w / h);
    effBoxRef.current = box;
    const rect = new fabric.Rect({
      left: box.x * w,
      top: box.y * h,
      width: box.width * w,
      height: box.height * h,
      // Fabric v7 defaults origin to center; the box coords are a top-left
      // anchor, so pin the origin or the rect renders offset by half its size.
      originX: "left",
      originY: "top",
      fill: "transparent",
      stroke: "#7664ff",
      strokeWidth: 1.5,
      strokeDashArray: [7, 6],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    Object.assign(rect, { [GUIDE_TAG]: true });
    printRectRef.current = rect;
    canvas.add(rect);
    canvas.sendObjectToBack(rect);
    // The area's admin-given name + real print dimensions, pinned above the
    // box's top-left corner (or just inside it when the box touches the top).
    const text =
      area.maxWidthIn && area.maxHeightIn
        ? `${area.name} · ${formatInches(area.maxWidthIn, area.maxHeightIn)}`
        : area.name;
    const labelTop = box.y * h - 18;
    const label = new fabric.FabricText(text, {
      left: box.x * w,
      top: labelTop < 2 ? box.y * h + 4 : labelTop,
      originX: "left",
      originY: "top",
      fontFamily: "Archivo, sans-serif",
      fontSize: 11,
      fontWeight: "700",
      fill: "#7664ff",
      backgroundColor: "rgba(255,255,255,0.85)",
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    Object.assign(label, { [GUIDE_TAG]: true });
    printLabelRef.current = label;
    canvas.add(label);
    canvas.bringObjectToFront(label);
    canvas.requestRenderAll();
  }

  /** The print guide (rect + label) — everything that isn't customer art.
   *  Checks the value tag as well as the refs so orphaned guides (from any
   *  load/reorder race) never count as art or leak into exports/measurements. */
  const isGuide = (o: fabric.FabricObject) =>
    o === printRectRef.current || o === printLabelRef.current || isGuideObject(o);

  useImperativeHandle(ref, () => ({
    setGarment(url) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const seq = ++garmentSeqRef.current;
      if (!url) {
        canvas.backgroundImage = undefined;
        canvas.requestRenderAll();
        onGarmentLoaded?.();
        return;
      }
      fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then((img) => {
        const c = canvasRef.current;
        // A newer setGarment superseded this load, so drop the stale image.
        if (!c || seq !== garmentSeqRef.current) return;
        const iw = img.width ?? DEFAULT_DIMS.w;
        const ih = img.height ?? DEFAULT_DIMS.h;
        const { w, h } = fitDims(iw, ih);
        dimsRef.current = { w, h };
        c.setDimensions({ width: w, height: h });
        // Fill the canvas exactly — aspect matches, so this is not a stretch
        // beyond sub-pixel rounding. The garment now fills the frame edge-to-edge.
        img.set({
          scaleX: w / iw,
          scaleY: h / ih,
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
          // Keep the garment out of exportScene() JSON: it is re-derived from
          // product+colour+view on load, and serializing it bloated every
          // scene/undo snapshot and reverted colour swaps on undo. Rendering
          // (mockup export included) is unaffected by this flag.
          excludeFromExport: true,
        });
        c.backgroundImage = img;
        // Re-place the dashed print guide against the (possibly resized) canvas.
        redrawPrintRect();
        c.requestRenderAll();
        onGarmentLoaded?.();
      });
    },
    setPrintArea(area) {
      printAreaRef.current = area;
      redrawPrintRect();
    },
    async addImageFromUrl(url) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
      const box = effBoxRef.current;
      const { w, h } = dimsRef.current;
      const targetW = (box ? box.width : 0.5) * w * 0.85;
      const scale = targetW / (img.width ?? targetW);
      img.set({ scaleX: scale, scaleY: scale });
      const cx = (box ? box.x + box.width / 2 : 0.5) * w;
      const cy = (box ? box.y + box.height / 2 : 0.5) * h;
      img.set({ left: cx, top: cy, originX: "center", originY: "center" });
      attachControls(img);
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
    },
    async addText(text, opts) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const box = effBoxRef.current;
      const { w, h } = dimsRef.current;
      const cx = (box ? box.x + box.width / 2 : 0.5) * w;
      const cy = (box ? box.y + box.height / 2 : 0.5) * h;
      const fontFamily = opts?.fontFamily ?? "Archivo, sans-serif";
      const fontWeight = opts?.fontWeight ?? "700";
      const t = new fabric.IText(text, {
        left: cx,
        top: cy,
        originX: "center",
        originY: "center",
        fontFamily,
        fontSize: 40,
        fill: opts?.fill ?? "#1b1458",
        fontWeight,
      });
      attachControls(t);
      canvas.add(t);
      canvas.setActiveObject(t);
      canvas.requestRenderAll();
      // Re-render once the face is loaded so the text isn't drawn in the fallback.
      await ensureFont(fontFamily, fontWeight);
      t.setCoords();
      canvas.requestRenderAll();
    },
    clearArt() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.getObjects().forEach((o) => {
        if (!isGuide(o)) canvas.remove(o);
      });
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    },
    deleteActive() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const objs = canvas.getActiveObjects();
      objs.forEach((o) => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    },
    isEditingText() {
      const o = canvasRef.current?.getActiveObject();
      return !!(o && o.type === "i-text" && (o as fabric.IText).isEditing);
    },
    async duplicateActive() {
      const canvas = canvasRef.current;
      const o = canvas?.getActiveObject();
      if (!canvas || !o || isGuide(o)) return;
      const clone = await o.clone();
      // Nudge the copy down-right so it doesn't sit exactly on the original.
      clone.set({ left: (o.left ?? 0) + 24, top: (o.top ?? 0) + 24 });
      attachControls(clone);
      canvas.add(clone);
      canvas.setActiveObject(clone);
      canvas.requestRenderAll();
      onChange?.();
    },
    flipActive(axis) {
      const canvas = canvasRef.current;
      const o = canvas?.getActiveObject();
      if (!canvas || !o) return;
      if (axis === "h") o.set("flipX", !o.flipX);
      else o.set("flipY", !o.flipY);
      o.setCoords();
      canvas.requestRenderAll();
      onChange?.();
    },
    centerActiveInPrintArea() {
      const canvas = canvasRef.current;
      const o = canvas?.getActiveObject();
      if (!canvas || !o) return;
      const box = effBoxRef.current;
      const { w, h } = dimsRef.current;
      const cx = (box ? box.x + box.width / 2 : 0.5) * w;
      const cy = (box ? box.y + box.height / 2 : 0.5) * h;
      // Position by the object's center regardless of its own origin.
      o.setXY(new fabric.Point(cx, cy), "center", "center");
      o.setCoords();
      canvas.requestRenderAll();
      onChange?.();
    },
    bringForward() {
      const canvas = canvasRef.current;
      const o = canvas?.getActiveObject();
      if (canvas && o) {
        canvas.bringObjectForward(o);
        canvas.requestRenderAll();
      }
    },
    sendBackward() {
      const canvas = canvasRef.current;
      const o = canvas?.getActiveObject();
      if (canvas && o) {
        canvas.sendObjectBackwards(o);
        if (printRectRef.current) canvas.sendObjectToBack(printRectRef.current);
        canvas.requestRenderAll();
      }
    },
    setActiveColor(hex) {
      const canvas = canvasRef.current;
      const o = canvas?.getActiveObject();
      if (canvas && o && o.type === "i-text") {
        (o as fabric.IText).set({ fill: hex });
        canvas.requestRenderAll();
        onChange?.();
      }
    },
    async setActiveFont(fontFamily, fontWeight = 400) {
      const canvas = canvasRef.current;
      const o = canvas?.getActiveObject();
      if (canvas && o && o.type === "i-text") {
        await ensureFont(fontFamily, fontWeight);
        (o as fabric.IText).set({ fontFamily, fontWeight });
        o.setCoords();
        canvas.requestRenderAll();
        onChange?.();
      }
    },
    renderAll() {
      canvasRef.current?.requestRenderAll();
    },
    exportScene() {
      const canvas = canvasRef.current;
      if (!canvas) return {};
      // Objects only (garment backdrop is re-derived from product+colour+view on load).
      return canvas.toObject();
    },
    async loadScene(json) {
      if (!json) return;
      const run = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Scenes saved by older builds carry the garment as backgroundImage;
        // it is always re-derived from product+colour+view, so drop it rather
        // than let loadFromJSON re-fetch (and possibly revert) the garment.
        const scene = { ...(json as Record<string, unknown>) };
        delete scene.backgroundImage;
        // loadFromJSON repopulates the canvas from the JSON, which resets
        // backgroundImage to whatever the JSON holds — i.e. nothing, since the
        // garment is kept out of the scene. Capture the live garment and put it
        // back afterwards so reopening a saved design (and undo/redo) keep the
        // shirt behind the art instead of a blank canvas.
        const garment = canvas.backgroundImage;
        await canvas.loadFromJSON(scene);
        if (garment && !canvas.backgroundImage) canvas.backgroundImage = garment;
        // Refs may point at guides loadFromJSON cleared; redrawPrintRect
        // sweeps every guide (tracked or orphaned) and draws a fresh pair.
        printRectRef.current = null;
        printLabelRef.current = null;
        // Re-attach the delete badge to the freshly deserialized objects.
        canvas.getObjects().forEach((o) => attachControls(o));
        redrawPrintRect();
        canvas.requestRenderAll();
      };
      // Chain so overlapping loads (rapid undo/redo) can never interleave.
      const p = loadChainRef.current.then(run);
      loadChainRef.current = p.catch(() => {});
      return p;
    },
    exportMockup() {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      // Render ONLY customer art. toDataURL ignores excludeFromExport (that
      // flag is serialization-only in Fabric), so the guide must be excluded
      // via the render filter. This also drops any orphaned guide the
      // hide-the-refs approach used to miss. The garment backgroundImage is
      // drawn separately and stays in the mockup.
      return canvas.toDataURL({
        format: "png",
        multiplier: 2,
        filter: (o) => !isGuide(o as fabric.FabricObject) && !o.excludeFromExport,
      });
    },
    hasObjects() {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      return canvas.getObjects().some((o) => !isGuide(o));
    },
    artOutsidePrintArea() {
      const canvas = canvasRef.current;
      const box = effBoxRef.current;
      if (!canvas || !box) return false;
      const { w, h } = dimsRef.current;
      const bx = box.x * w,
        by = box.y * h,
        bw = box.width * w,
        bh = box.height * h;
      return canvas.getObjects().some((o) => {
        if (isGuide(o)) return false;
        // After a programmatic load (loadFromJSON on undo/redo/scene restore)
        // an object's cached corner coords can be stale; refresh them so the
        // rotation-aware bounding box is measured against the real placement.
        o.setCoords();
        const r = o.getBoundingRect();
        return r.left < bx - 1 || r.top < by - 1 || r.left + r.width > bx + bw + 1 || r.top + r.height > by + bh + 1;
      });
    },
    artMetrics() {
      const canvas = canvasRef.current;
      const box = effBoxRef.current;
      const area = printAreaRef.current;
      if (!canvas || !box || !area) return null;
      const ppi = boxPxPerInch(box, area.maxWidthIn, dimsRef.current.w);
      if (!ppi) return null;
      // Union bounding box of every art object — the printed footprint of the
      // whole composition on this side (rotation-aware via getBoundingRect).
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      let any = false;
      for (const o of canvas.getObjects()) {
        if (isGuide(o)) continue;
        any = true;
        o.setCoords();
        const r = o.getBoundingRect();
        minX = Math.min(minX, r.left);
        minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.left + r.width);
        maxY = Math.max(maxY, r.top + r.height);
      }
      if (!any) return null;
      const round1 = (n: number) => Math.round(n * 10) / 10;
      return { widthIn: round1((maxX - minX) / ppi), heightIn: round1((maxY - minY) / ppi) };
    },
    getArtDescriptors() {
      const canvas = canvasRef.current;
      if (!canvas) return [];
      const out: ArtDescriptor[] = [];
      for (const o of canvas.getObjects()) {
        if (isGuide(o)) continue;
        if (o.type === "i-text" || o.type === "text" || o.type === "textbox") {
          out.push({ type: "text", fill: String((o as fabric.IText).fill ?? "#000000") });
        } else if (o.type === "image") {
          out.push({ type: "image", src: (o as fabric.FabricImage).getSrc() });
        }
      }
      return out;
    },
    recalcOffset() {
      // The canvas is CSS-scaled for zoom; refresh Fabric's cached element
      // offset so pointer→canvas mapping stays accurate after a zoom change.
      canvasRef.current?.calcOffset();
    },
  }));

  return (
    <div className="flex w-full justify-center">
      <canvas ref={elRef} className="rounded-xl border border-dream-line" />
    </div>
  );
});
