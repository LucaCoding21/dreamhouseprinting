"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as fabric from "fabric";
import {
  effectivePrintBox,
  boxPxPerInch,
  formatInches,
  zoneIndexForPoint,
  type NormalizedBox,
} from "@/lib/design/printArea";
import { ssLargeImage } from "@/lib/ss/images";

export type PrintBox = NormalizedBox; // normalized 0..1

/** Everything the canvas needs to draw + label + measure one print area. */
export interface PrintAreaSpec {
  /** The print_areas row id. Identifies this zone in every downstream record. */
  id: string;
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
  /** Every zone on this side, drawn at once. Order is the caller's; all
   *  per-zone results below are index-aligned to it. */
  setPrintAreas: (areas: PrintAreaSpec[]) => void;
  /** `zone` targets which box new art is centred in (default: the first). */
  addImageFromUrl: (url: string, zone?: number) => Promise<void>;
  addText: (
    text: string,
    opts?: {
      fontFamily?: string;
      fontWeight?: number | string;
      fill?: string;
      fontSize?: number;
      textAlign?: "left" | "center" | "right";
      zone?: number;
    }
  ) => void;
  clearArt: () => void;
  deleteActive: () => void;
  /** Drop any object selection on this canvas (no history change). */
  discardSelection: () => void;
  isEditingText: () => boolean;
  duplicateActive: () => Promise<void>;
  flipActive: (axis: "h" | "v") => void;
  centerActiveInPrintArea: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  setActiveColor: (hex: string) => void;
  setActiveFont: (fontFamily: string, fontWeight?: number | string) => void;
  setActiveTextAlign: (align: "left" | "center" | "right") => void;
  setActiveFontSize: (size: number) => void;
  /** Style of the selected text object (for syncing the tool controls), or null. */
  getActiveTextProps: () => { fontSize: number; textAlign: string; fill: string; fontFamily: string } | null;
  renderAll: () => void;
  exportScene: () => object;
  loadScene: (json: object | null) => Promise<void>;
  exportMockup: () => string | null;
  hasObjects: () => boolean;
  /** Per-zone art state, index-aligned to the last setPrintAreas call. Art is
   *  assigned to exactly one zone (see zoneIndexForPoint), so a side with a
   *  left chest and a full front reports them as two independent prints. */
  zoneReport: () => ZoneReport[];
  recalcOffset: () => void;
}

/** Everything downstream needs to know about one zone's artwork. */
export interface ZoneReport {
  hasArt: boolean;
  /** Any of this zone's art spilling outside its box. */
  outside: boolean;
  metrics: ArtMetrics | null;
  descriptors: ArtDescriptor[];
}

// The canvas sizes itself to the garment image's aspect ratio (within this
// envelope) so the garment FILLS the frame with no letterboxing. That makes
// normalized 0..1 print-area coords map 1:1 to canvas pixels, the same basis
// the admin PrintAreaEditor uses, so the print box lines up exactly across
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
 * Ensure a web font is downloaded before Fabric measures/renders text with it,
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
    /** Fired after a USER transform (move/scale/rotate) or a committed text
     *  edit, with the scene as it was BEFORE the change. The parent pushes it
     *  onto the undo history. Programmatic loads (loadScene/colour swaps) never
     *  fire this, so they can't pollute history. */
    onModifyCommit?: (preScene: object) => void;
  }
>(function DesignCanvas({ onSelectionChange, onChange, onGarmentLoaded, onRequestDelete, onModifyCommit }, ref) {
  const elRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  // Guide objects currently on the canvas (one rect + one label per zone).
  // Kept as a flat list because the only thing done with them is "sweep them
  // all before redrawing" and "keep them on top of new art".
  const guideObjectsRef = useRef<fabric.FabricObject[]>([]);
  const printAreasRef = useRef<PrintAreaSpec[]>([]);
  // The inch-true boxes actually drawn/measured against, index-aligned to
  // printAreasRef (see lib/design/printArea).
  const effBoxesRef = useRef<PrintBox[]>([]);
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
  // Latest modify-commit callback, read by the (stable) canvas event handlers.
  const onModifyCommitRef = useRef(onModifyCommit);
  onModifyCommitRef.current = onModifyCommit;

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

    // --- Undo history for USER edits (move/scale/rotate + text edits) ---------
    // A transform is captured at gesture start (before:transform) and committed
    // at gesture end (object:modified). We hand the parent the PRE-change scene
    // so an undo restores it. `toObject()` respects excludeFromExport, so the
    // print guides are omitted (same basis as exportScene). preScene is cleared
    // on mouse:up so a click that starts but doesn't move an object can't leave a
    // stale snapshot behind for the next real edit.
    let preScene: object | null = null;
    canvas.on("before:transform", () => {
      if (!preScene) preScene = canvas.toObject();
    });
    canvas.on("object:modified", () => {
      if (preScene) {
        onModifyCommitRef.current?.(preScene);
        preScene = null;
      } else {
        onChange?.();
      }
    });
    canvas.on("mouse:up", () => {
      preScene = null;
    });
    // Text edits: snapshot on entering the editor, commit on exit only if the
    // text actually changed (so merely clicking into and out of a box is a no-op).
    let preEdit: object | null = null;
    let preEditText: string | null = null;
    canvas.on("text:editing:entered", (e) => {
      preEdit = canvas.toObject();
      const t = e.target as fabric.IText | undefined;
      preEditText = t ? (t.text ?? "") : "";
    });
    canvas.on("text:editing:exited", (e) => {
      const t = e.target as fabric.IText | undefined;
      if (preEdit && t && (t.text ?? "") !== preEditText) {
        onModifyCommitRef.current?.(preEdit);
      } else {
        onChange?.();
      }
      preEdit = null;
      preEditText = null;
    });

    canvas.on("object:added", (e) => {
      // Keep the print-area labels readable above newly added art. Only reorder
      // a label that is STILL on the canvas: bringObjectToFront pushes its
      // argument into the object stack unconditionally, so calling it with a
      // label that loadFromJSON's clear() just removed would resurrect it as
      // an untracked orphan (which then bakes into exported mockups).
      const live = canvas.getObjects();
      for (const g of guideObjectsRef.current) {
        if (g !== e.target && g.type === "text" && live.includes(g)) canvas.bringObjectToFront(g);
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
    // Sweep EVERY guide off the canvas, the tracked ones AND any tag-marked
    // orphan a scene load may have left behind, before drawing fresh ones.
    canvas
      .getObjects()
      .filter((o) => isGuide(o))
      .forEach((o) => canvas.remove(o));
    guideObjectsRef.current = [];
    effBoxesRef.current = [];

    const areas = printAreasRef.current;
    if (areas.length === 0) {
      canvas.requestRenderAll();
      return;
    }
    const { w, h } = dimsRef.current;
    // Reconcile each drawn envelope with its physical inch dims: the box we
    // render (and measure inside) is the largest inch-aspect-true rect that
    // fits the envelope, so px-per-inch is uniform on both axes.
    effBoxesRef.current = areas.map((a) => effectivePrintBox(a.box, a.maxWidthIn, a.maxHeightIn, w / h));

    // Rects first (all sent to the back), then labels on top, so a big zone's
    // outline can never be drawn over a nested zone's label.
    const labels: fabric.FabricObject[] = [];
    areas.forEach((area, i) => {
      const box = effBoxesRef.current[i];
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
      canvas.add(rect);
      canvas.sendObjectToBack(rect);
      guideObjectsRef.current.push(rect);

      // The zone's admin-given name + real print dimensions, pinned above its
      // top-left corner (or just inside it when the box touches the top).
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
      canvas.add(label);
      labels.push(label);
      guideObjectsRef.current.push(label);
    });
    labels.forEach((l) => canvas.bringObjectToFront(l));
    canvas.requestRenderAll();
  }

  /** The print guides (rects + labels), everything that isn't customer art.
   *  Checks the value tag as well as the tracked list so orphaned guides (from
   *  any load/reorder race) never count as art or leak into exports. */
  const isGuide = (o: fabric.FabricObject) =>
    isGuideObject(o) || guideObjectsRef.current.includes(o);

  /** Live art objects on the canvas, with fresh corner coords. After a
   *  programmatic load (undo/redo/scene restore) cached coords can be stale,
   *  so every geometry read refreshes them first. */
  function artObjects(): fabric.FabricObject[] {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    const out = canvas.getObjects().filter((o) => !isGuide(o));
    out.forEach((o) => o.setCoords());
    return out;
  }

  /** The zone each art object belongs to, index into effBoxesRef. Assignment
   *  is by the object's centre so dragging art from the chest into the middle
   *  of the shirt re-homes it, which is what the customer expects to see. */
  function zoneOf(o: fabric.FabricObject): number {
    const { w, h } = dimsRef.current;
    const r = o.getBoundingRect();
    const cx = (r.left + r.width / 2) / w;
    const cy = (r.top + r.height / 2) / h;
    return zoneIndexForPoint(cx, cy, effBoxesRef.current);
  }

  /** Centre point of a zone in canvas pixels, for placing new art. Falls back
   *  to the canvas centre when the side has no zones configured. */
  function zoneCentre(zone: number): { cx: number; cy: number } {
    const { w, h } = dimsRef.current;
    const box = effBoxesRef.current[zone] ?? effBoxesRef.current[0] ?? null;
    return {
      cx: (box ? box.x + box.width / 2 : 0.5) * w,
      cy: (box ? box.y + box.height / 2 : 0.5) * h,
    };
  }

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
      // Load the large S&S variant (1000x1250): the canvas draws the garment at
      // up to ~1,600 device pixels wide, so the stored medium photo (500x625)
      // upscales visibly. If a large ever 404s, fall back to the stored URL.
      const large = ssLargeImage(url);
      const load = (src: string) => fabric.FabricImage.fromURL(src, { crossOrigin: "anonymous" });
      (large === url ? load(url) : load(large).catch(() => load(url))).then((img) => {
        const c = canvasRef.current;
        // A newer setGarment superseded this load, so drop the stale image.
        if (!c || seq !== garmentSeqRef.current) return;
        const iw = img.width ?? DEFAULT_DIMS.w;
        const ih = img.height ?? DEFAULT_DIMS.h;
        const { w, h } = fitDims(iw, ih);
        dimsRef.current = { w, h };
        c.setDimensions({ width: w, height: h });
        // Fill the canvas exactly, aspect matches, so this is not a stretch
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
    setPrintAreas(areas) {
      printAreasRef.current = areas;
      redrawPrintRect();
    },
    async addImageFromUrl(url, zone = 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
      const { w } = dimsRef.current;
      const box = effBoxesRef.current[zone] ?? effBoxesRef.current[0] ?? null;
      const targetW = (box ? box.width : 0.5) * w * 0.85;
      const scale = targetW / (img.width ?? targetW);
      img.set({ scaleX: scale, scaleY: scale });
      const { cx, cy } = zoneCentre(zone);
      img.set({ left: cx, top: cy, originX: "center", originY: "center" });
      attachControls(img);
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
    },
    async addText(text, opts) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { cx, cy } = zoneCentre(opts?.zone ?? 0);
      const fontFamily = opts?.fontFamily ?? "Archivo, sans-serif";
      const fontWeight = opts?.fontWeight ?? "700";
      const t = new fabric.IText(text, {
        left: cx,
        top: cy,
        originX: "center",
        originY: "center",
        fontFamily,
        fontSize: opts?.fontSize ?? 40,
        fill: opts?.fill ?? "#1b1458",
        fontWeight,
        textAlign: opts?.textAlign ?? "center",
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
    discardSelection() {
      const canvas = canvasRef.current;
      if (!canvas) return;
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
      // Centre it in the zone it already belongs to, so centring a chest logo
      // keeps it on the chest instead of yanking it to another zone.
      o.setCoords();
      const { cx, cy } = zoneCentre(Math.max(0, zoneOf(o)));
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
        // The dashed outlines stay behind every piece of art.
        const live = canvas.getObjects();
        for (const g of guideObjectsRef.current) {
          if (g.type === "rect" && live.includes(g)) canvas.sendObjectToBack(g);
        }
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
    setActiveTextAlign(align) {
      const canvas = canvasRef.current;
      const o = canvas?.getActiveObject();
      if (canvas && o && o.type === "i-text") {
        (o as fabric.IText).set({ textAlign: align });
        o.setCoords();
        canvas.requestRenderAll();
        onChange?.();
      }
    },
    setActiveFontSize(size) {
      const canvas = canvasRef.current;
      const o = canvas?.getActiveObject();
      if (canvas && o && o.type === "i-text") {
        (o as fabric.IText).set({ fontSize: size });
        o.setCoords();
        canvas.requestRenderAll();
        onChange?.();
      }
    },
    getActiveTextProps() {
      const o = canvasRef.current?.getActiveObject();
      if (!o || o.type !== "i-text") return null;
      const t = o as fabric.IText;
      return {
        fontSize: Math.round(t.fontSize ?? 40),
        textAlign: (t.textAlign as string) ?? "left",
        fill: String(t.fill ?? "#000000"),
        fontFamily: String(t.fontFamily ?? ""),
      };
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
        // backgroundImage to whatever the JSON holds, i.e. nothing, since the
        // garment is kept out of the scene. Capture the live garment and put it
        // back afterwards so reopening a saved design (and undo/redo) keep the
        // shirt behind the art instead of a blank canvas.
        const garment = canvas.backgroundImage;
        await canvas.loadFromJSON(scene);
        if (garment && !canvas.backgroundImage) canvas.backgroundImage = garment;
        // The tracked list may point at guides loadFromJSON cleared;
        // redrawPrintRect sweeps every guide (tracked or orphaned by tag) and
        // draws a fresh set.
        guideObjectsRef.current = [];
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
      // Scale the export to a real output size. The on-screen canvas is small
      // (a few hundred px), so a fixed 2x came out visibly low res in the admin
      // and on proofs. Target ~1600px on the long edge, never below 2x.
      const long = Math.max(canvas.getWidth(), canvas.getHeight(), 1);
      return canvas.toDataURL({
        format: "png",
        multiplier: Math.min(6, Math.max(2, 1600 / long)),
        filter: (o) => !isGuide(o as fabric.FabricObject) && !o.excludeFromExport,
      });
    },
    hasObjects() {
      return artObjects().length > 0;
    },
    zoneReport() {
      const areas = printAreasRef.current;
      const boxes = effBoxesRef.current;
      const { w, h } = dimsRef.current;
      const reports: ZoneReport[] = areas.map(() => ({
        hasArt: false,
        outside: false,
        metrics: null,
        descriptors: [],
      }));
      if (areas.length === 0) return reports;

      // Union bounding box per zone, in canvas px, built as we walk the art.
      const bounds = areas.map(() => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }));

      for (const o of artObjects()) {
        const z = zoneOf(o);
        if (z < 0) continue;
        const r = o.getBoundingRect();
        const rep = reports[z];
        rep.hasArt = true;

        if (o.type === "i-text" || o.type === "text" || o.type === "textbox") {
          rep.descriptors.push({ type: "text", fill: String((o as fabric.IText).fill ?? "#000000") });
        } else if (o.type === "image") {
          rep.descriptors.push({ type: "image", src: (o as fabric.FabricImage).getSrc() });
        }

        const b = bounds[z];
        b.minX = Math.min(b.minX, r.left);
        b.minY = Math.min(b.minY, r.top);
        b.maxX = Math.max(b.maxX, r.left + r.width);
        b.maxY = Math.max(b.maxY, r.top + r.height);

        // Out of bounds is judged against the zone the art belongs to, so a
        // chest logo nudged off the chest box is flagged even though it still
        // sits well inside the full-front box around it.
        const box = boxes[z];
        const bx = box.x * w,
          by = box.y * h,
          bw = box.width * w,
          bh = box.height * h;
        if (r.left < bx - 1 || r.top < by - 1 || r.left + r.width > bx + bw + 1 || r.top + r.height > by + bh + 1) {
          rep.outside = true;
        }
      }

      const round1 = (n: number) => Math.round(n * 10) / 10;
      areas.forEach((area, i) => {
        if (!reports[i].hasArt) return;
        const ppi = boxPxPerInch(boxes[i], area.maxWidthIn, w);
        if (!ppi) return;
        const b = bounds[i];
        reports[i].metrics = {
          widthIn: round1((b.maxX - b.minX) / ppi),
          heightIn: round1((b.maxY - b.minY) / ppi),
        };
      });
      return reports;
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
