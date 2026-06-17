"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as fabric from "fabric";

export interface PrintBox {
  x: number;
  y: number;
  width: number;
  height: number;
} // normalized 0..1

export interface DesignCanvasHandle {
  setGarment: (url: string | null) => void;
  setPrintArea: (box: PrintBox | null) => void;
  addImageFromUrl: (url: string) => Promise<void>;
  addText: (text: string) => void;
  clearArt: () => void;
  deleteActive: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  setActiveColor: (hex: string) => void;
  exportScene: () => object;
  loadScene: (json: object | null) => Promise<void>;
  exportMockup: () => string | null;
  hasObjects: () => boolean;
  artOutsidePrintArea: () => boolean;
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

export const DesignCanvas = forwardRef<
  DesignCanvasHandle,
  { onSelectionChange?: (hasSelection: boolean) => void; onChange?: () => void }
>(function DesignCanvas({ onSelectionChange, onChange }, ref) {
  const elRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const printRectRef = useRef<fabric.Rect | null>(null);
  const printBoxRef = useRef<PrintBox | null>(null);
  const dimsRef = useRef({ ...DEFAULT_DIMS });

  useEffect(() => {
    if (!elRef.current) return;
    const canvas = new fabric.Canvas(elRef.current, {
      width: dimsRef.current.w,
      height: dimsRef.current.h,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });
    canvasRef.current = canvas;

    const emitSel = () => onSelectionChange?.(!!canvas.getActiveObject());
    canvas.on("selection:created", emitSel);
    canvas.on("selection:updated", emitSel);
    canvas.on("selection:cleared", () => onSelectionChange?.(false));
    canvas.on("object:modified", () => onChange?.());
    canvas.on("object:added", () => onChange?.());
    canvas.on("object:removed", () => onChange?.());

    return () => {
      canvas.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function redrawPrintRect() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (printRectRef.current) {
      canvas.remove(printRectRef.current);
      printRectRef.current = null;
    }
    const box = printBoxRef.current;
    if (!box) {
      canvas.requestRenderAll();
      return;
    }
    const { w, h } = dimsRef.current;
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
    printRectRef.current = rect;
    canvas.add(rect);
    canvas.sendObjectToBack(rect);
    canvas.requestRenderAll();
  }

  useImperativeHandle(ref, () => ({
    setGarment(url) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!url) {
        canvas.backgroundImage = undefined;
        canvas.requestRenderAll();
        return;
      }
      fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then((img) => {
        const c = canvasRef.current;
        if (!c) return;
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
        });
        c.backgroundImage = img;
        // Re-place the dashed print guide against the (possibly resized) canvas.
        redrawPrintRect();
        c.requestRenderAll();
      });
    },
    setPrintArea(box) {
      printBoxRef.current = box;
      redrawPrintRect();
    },
    async addImageFromUrl(url) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
      const box = printBoxRef.current;
      const { w, h } = dimsRef.current;
      const targetW = (box ? box.width : 0.5) * w * 0.85;
      const scale = targetW / (img.width ?? targetW);
      img.set({ scaleX: scale, scaleY: scale });
      const cx = (box ? box.x + box.width / 2 : 0.5) * w;
      const cy = (box ? box.y + box.height / 2 : 0.5) * h;
      img.set({ left: cx, top: cy, originX: "center", originY: "center" });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
    },
    addText(text) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const box = printBoxRef.current;
      const { w, h } = dimsRef.current;
      const cx = (box ? box.x + box.width / 2 : 0.5) * w;
      const cy = (box ? box.y + box.height / 2 : 0.5) * h;
      const t = new fabric.IText(text, {
        left: cx,
        top: cy,
        originX: "center",
        originY: "center",
        fontFamily: "Archivo, sans-serif",
        fontSize: 40,
        fill: "#1b1458",
        fontWeight: "700",
      });
      canvas.add(t);
      canvas.setActiveObject(t);
      canvas.requestRenderAll();
    },
    clearArt() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.getObjects().forEach((o) => {
        if (o !== printRectRef.current) canvas.remove(o);
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
    exportScene() {
      const canvas = canvasRef.current;
      if (!canvas) return {};
      // Objects only (garment backdrop is re-derived from product+colour+view on load).
      return canvas.toObject();
    },
    async loadScene(json) {
      const canvas = canvasRef.current;
      if (!canvas || !json) return;
      await canvas.loadFromJSON(json);
      // Strip any persisted print rect; it's redrawn from current box.
      printRectRef.current = null;
      redrawPrintRect();
      canvas.requestRenderAll();
    },
    exportMockup() {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      // Temporarily hide the dashed guide for a clean mockup.
      const rect = printRectRef.current;
      if (rect) rect.visible = false;
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      const data = canvas.toDataURL({ format: "png", multiplier: 2 });
      if (rect) rect.visible = true;
      canvas.requestRenderAll();
      return data;
    },
    hasObjects() {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      return canvas.getObjects().some((o) => o !== printRectRef.current);
    },
    artOutsidePrintArea() {
      const canvas = canvasRef.current;
      const box = printBoxRef.current;
      if (!canvas || !box) return false;
      const { w, h } = dimsRef.current;
      const bx = box.x * w,
        by = box.y * h,
        bw = box.width * w,
        bh = box.height * h;
      return canvas.getObjects().some((o) => {
        if (o === printRectRef.current) return false;
        const r = o.getBoundingRect();
        return r.left < bx - 1 || r.top < by - 1 || r.left + r.width > bx + bw + 1 || r.top + r.height > by + bh + 1;
      });
    },
  }));

  return (
    <div className="flex w-full justify-center">
      <canvas ref={elRef} className="rounded-xl border border-dream-line" />
    </div>
  );
});
