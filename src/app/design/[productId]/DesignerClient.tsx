"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import { DesignCanvas, type DesignCanvasHandle, type PrintBox } from "./DesignCanvas";
import { saveDraftAction, type DesignSubmitInput } from "./actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/cart/CartContext";
import { formatCAD, roundCents } from "@/lib/money";
import { calcPrice } from "@/lib/pricing/platform";
import { fmtDate, inHandsWindow } from "@/lib/turnaround";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { swatchStyle } from "@/lib/swatch";
import type { ProductColourJson, PrintAreaPositionJson } from "@/lib/db/rows";

type View = "front" | "back" | "sleeve";
type Tool = "upload" | "text" | "clipart";

interface PrintAreaLite {
  id: string;
  name: string;
  view: string;
  position: PrintAreaPositionJson;
  maxWidthIn: number | null;
  maxHeightIn: number | null;
}
interface MethodLite {
  id: string;
  name: string;
  setup_fee: number;
  per_unit_cost: number;
  per_color_cost: number;
}

/** A saved design loaded for editing — rehydrates the canvas + review state. */
export interface InitialDesign {
  designId: string;
  name: string | null;
  leadEmail: string | null;
  colourName: string | null;
  methodId: string | null;
  primarySizeQty: Record<string, number>;
  extraColorways: { colourName: string; sizeQty: Record<string, number> }[];
  /** Per-view Fabric canvas JSON, loaded into each canvas once its garment is ready. */
  scenes: Record<string, object>;
}

interface Props {
  productId: string;
  productName: string;
  brand: string | null;
  description: string | null;
  stockStatus: string;
  pricing: {
    wholesale_cost: number | null;
    base_price: number | null;
    markup_type: string;
    markup_value: number;
    pricing_rules: unknown;
  };
  leadTimeDays: number;
  colours: ProductColourJson[];
  sizes: { name: string; inStock: boolean }[];
  printAreas: PrintAreaLite[];
  methods: MethodLite[];
  isLoggedIn: boolean;
  accountEmail: string | null;
  startAsQuote: boolean;
  /** Colour the customer picked on the product page; defaults to the first. */
  initialColourName?: string;
  /** When set, the designer reopens this saved design for editing. */
  initialDesign?: InitialDesign | null;
}

function normView(v: string): View {
  if (v === "back") return "back";
  if (v === "left_sleeve" || v === "right_sleeve" || v === "sleeve") return "sleeve";
  return "front";
}
const VIEW_LABEL: Record<View, string> = { front: "Front", back: "Back", sleeve: "Sleeve" };

function imageForView(colour: ProductColourJson | undefined, view: View): string | null {
  if (!colour) return null;
  const img = colour.images;
  if (view === "back") return img.back ?? img.front;
  if (view === "sleeve") return img.side ?? img.front;
  return img.front;
}

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.15, 1.35, 1.6];

// Quick-pick text colours (common ink colours). 15 presets + a custom picker
// fill two rows of eight. Lowercase so selection matching is case-insensitive.
const TEXT_COLORS = [
  "#ffffff", "#d1d5db", "#6b7280", "#111111", "#1b1458", "#2563eb", "#38bdf8", "#14b8a6",
  "#16a34a", "#facc15", "#f97316", "#ef4444", "#be123c", "#ec4899", "#7c3aed",
];

// A graph-paper grid that bleeds behind the whole canvas column.
const GRID_BG: React.CSSProperties = {
  backgroundColor: "#fbfaff",
  backgroundImage:
    "linear-gradient(to right, rgba(118,100,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(118,100,255,0.10) 1px, transparent 1px)",
  backgroundSize: "26px 26px",
};

// Floating canvas toolbars — frosted glass, no drop shadow, so the chrome sits
// light over the grid instead of reading as a raised surface.
const GLASS = "rounded-2xl bg-white/60 ring-1 ring-dream-ink/[0.06] backdrop-blur-md";

// A small built-in clip-art tray. Each entry is an inline SVG rendered onto the
// Fabric canvas as an image (the canvas loads any image URL, including data
// URLs). The star reuses the brand-purple star icon supplied for the toolbar.
const CLIPART: { name: string; svg: string }[] = [
  {
    name: "Star",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.8L5.4 21l1.7-7L1.7 9.5l7.1-.6z" fill="#7664ff"/></svg>`,
  },
  {
    name: "Heart",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.7-9.7-9.1C.8 8.6 2.3 5.3 5.5 5.3c2 0 3.4 1.2 4.2 2.6C10.6 6.5 12 5.3 14 5.3c3.2 0 4.7 3.3 3.2 6.6C19 16.3 12 21 12 21z" fill="#ff5d8f"/></svg>`,
  },
  {
    name: "Circle",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1b1458"/></svg>`,
  },
  {
    name: "Bolt",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="#ffc83d"/></svg>`,
  },
  {
    name: "Burst",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24"><path d="M12 1l2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2z" fill="#7664ff"/></svg>`,
  },
  {
    name: "Smile",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffc83d"/><circle cx="9" cy="10" r="1.3" fill="#1b1458"/><circle cx="15" cy="10" r="1.3" fill="#1b1458"/><path d="M8 14c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4" fill="none" stroke="#1b1458" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  },
];

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "upload", label: "Upload", icon: "/designer/upload.svg" },
  { id: "text", label: "Text", icon: "/designer/tool-text.svg" },
  { id: "clipart", label: "Clipart", icon: "/designer/tool-clipart.svg" },
];

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function DesignerClient(props: Props) {
  const router = useRouter();
  const { addItem } = useCart();
  // One Fabric canvas per decorated view (front/back/...), all mounted at once
  // and editable side by side. Keyed by view.
  const canvasRefs = useRef<Record<string, DesignCanvasHandle | null>>({});
  const stageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Per-view undo/redo stacks (each canvas owns its own history).
  const histories = useRef<Record<string, object[]>>({});
  const futures = useRef<Record<string, object[]>>({});

  // Distinct views that have a print area, ordered.
  const views = useMemo(() => {
    const set = new Set<View>(props.printAreas.map((p) => normView(p.view)));
    return (["front", "back", "sleeve"] as View[]).filter((v) => set.has(v));
  }, [props.printAreas]);

  const edit = props.initialDesign ?? null;
  const [colourName, setColourName] = useState(
    edit?.colourName ?? props.initialColourName ?? props.colours[0]?.name ?? "",
  );
  // The canvas that tool actions (upload/text/clip-art/undo) target. The user
  // switches it by clicking a canvas or the "Adding to" pills.
  const [activeView, setActiveView] = useState<View>(views[0] ?? "front");
  const [tool, setTool] = useState<Tool>("upload");
  // Left panel collapse — shrinks the column to just the icon rail.
  const [leftOpen, setLeftOpen] = useState(true);
  // Friendly heads-up when an uploaded raster is a bit low-res for large prints.
  const [lowResNote, setLowResNote] = useState<string | null>(null);
  const [methodId, setMethodId] = useState(
    (edit?.methodId && props.methods.some((m) => m.id === edit.methodId) ? edit.methodId : null) ??
      props.methods[0]?.id ??
      null,
  );
  // Per-size quantity breakdown, collected on the review screen. Total quantity
  // is derived from the sum and drives pricing.
  const [sizeQty, setSizeQty] = useState<Record<string, number>>(edit?.primarySizeQty ?? {});
  // Additional garment colourways for the same artwork — each with its own size
  // breakdown. The primary (canvas) colour + sizeQty is the first colourway;
  // these are the "Add another colour" rows on the review screen.
  const [extraColorways, setExtraColorways] = useState<
    { id: string; colourName: string; sizeQty: Record<string, number> }[]
  >(() => (edit?.extraColorways ?? []).map((c, i) => ({ id: `cw-${i}`, ...c })));
  // Ink-colour count is determined from the artwork at proofing, not chosen here.
  const inkColours = 1;
  // Rush delivery is disabled for now — the toggle was removed from the review
  // screen. Kept as a const so the pricing/snapshot plumbing stays intact.
  const rush = false;
  const [viewsWithArt, setViewsWithArt] = useState<Set<View>>(new Set());
  // Views where some artwork spills past the dashed print box. Purely a friendly
  // heads-up — never blocks ordering (a human rechecks every design at proofing).
  const [outOfBounds, setOutOfBounds] = useState<Set<View>>(new Set());
  // Which canvas currently has a selected object (drives the selection toolbar).
  const [selection, setSelection] = useState<{ view: View } | null>(null);
  // Views whose garment image has finished loading (for the per-canvas shimmer).
  const [loadedViews, setLoadedViews] = useState<Set<View>>(new Set());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Zoom of the canvas stage. Single mode fits one canvas at 1; "see both"
  // drops it so two fit side by side.
  const [zoom, setZoom] = useState(1);
  // Single = one side shown big (default); both = side-by-side. Only meaningful
  // when the product has more than one decorated view.
  const [viewMode, setViewMode] = useState<"single" | "both">("single");
  const [busy, setBusy] = useState<null | "save" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  // Two-screen flow: design the artwork, then a review screen collects the
  // quantity and shows pricing before the order is placed.
  const [phase, setPhase] = useState<"design" | "review">("design");
  // Mockup of the design, rendered on the left of the review screen.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textColor, setTextColor] = useState("#1b1458");
  // "Save your design" modal — gates the checkout funnel, captures a name + lead
  // email before we send the customer into checkout.
  const [showSave, setShowSave] = useState(false);
  const [designName, setDesignName] = useState(edit?.name || props.productName);
  const [leadEmail, setLeadEmail] = useState(edit?.leadEmail || props.accountEmail || "");
  const [saveError, setSaveError] = useState<string | null>(null);

  const artworkFiles = useRef<{ id: string; file: File }[]>([]);

  const colour = props.colours.find((c) => c.name === colourName);
  const method = props.methods.find((m) => m.id === methodId) ?? null;
  const printAreaForView = (v: View) => props.printAreas.find((p) => normView(p.view) === v);
  const boxForView = (v: View): PrintBox | null => {
    const pa = printAreaForView(v);
    return pa ? pa.position : null;
  };

  const sizeRange =
    props.sizes.length > 0 ? `${props.sizes[0].name} to ${props.sizes[props.sizes.length - 1].name}` : null;

  const productInput = useMemo(
    () => ({
      wholesale_cost: props.pricing.wholesale_cost,
      base_price: props.pricing.base_price,
      markup_type: props.pricing.markup_type,
      markup_value: props.pricing.markup_value,
      pricing_rules: props.pricing.pricing_rules as never,
    }),
    [props.pricing]
  );
  const locationCount = Math.max(1, viewsWithArt.size);

  // Per-colourway pricing. Each colour is bulk-tiered on ITS OWN quantity; the
  // one-time setup is quantity-independent and counted once for the whole job.
  const colourwayList = useMemo(
    () => [
      { colourName, sizeQty },
      ...extraColorways.map((e) => ({ colourName: e.colourName, sizeQty: e.sizeQty })),
    ],
    [colourName, sizeQty, extraColorways]
  );

  const pricedColorways = useMemo(
    () =>
      colourwayList.map((cw) => {
        const qty = Object.values(cw.sizeQty).reduce((s, n) => s + (n > 0 ? n : 0), 0);
        const p = calcPrice({
          product: productInput,
          method,
          quantity: Math.max(qty, 1),
          colourCount: inkColours,
          locationCount,
        });
        return {
          colourName: cw.colourName,
          hex: props.colours.find((c) => c.name === cw.colourName)?.hex ?? null,
          sizeQty: cw.sizeQty,
          quantity: qty,
          unitPrice: p.unitPrice,
          lineTotal: roundCents(p.unitPrice * qty),
        };
      }),
    [colourwayList, productInput, method, inkColours, locationCount, props.colours]
  );

  const quantity = pricedColorways.reduce((s, c) => s + c.quantity, 0);
  const setupTotal = useMemo(
    () => calcPrice({ product: productInput, method, quantity: 1, colourCount: inkColours, locationCount }).setupTotal,
    [productInput, method, inkColours, locationCount]
  );
  const grandSubtotal = roundCents(pricedColorways.reduce((s, c) => s + c.lineTotal, 0));
  const breakdown = {
    unitPrice: pricedColorways[0]?.unitPrice ?? 0,
    subtotal: grandSubtotal,
    setupTotal,
    total: roundCents(grandSubtotal + setupTotal),
  };
  // Pre-discount unit price + bulk-tier savings for the headline estimate box
  // (matches the instant-estimate box on the product page). Computed on the
  // primary colourway's qty so it aligns with breakdown.unitPrice.
  const priceMeta = useMemo(() => {
    const primaryQty = pricedColorways[0]?.quantity ?? 0;
    const p = calcPrice({ product: productInput, method, quantity: Math.max(primaryQty, 1), colourCount: inkColours, locationCount });
    return { anchorPerUnit: roundCents(p.garmentRetail + p.decorationPerUnit), discountPct: p.bulkDiscountPct };
  }, [pricedColorways, productInput, method, inkColours, locationCount]);

  // Next bulk tier within reach — powers the "add N more to save X%" nudge.
  // Reads the same product.pricing_rules.bulkTiers the pricing engine discounts
  // on, so it stays silent (correctly) on products without tiers.
  const nextTier = useMemo(() => {
    const rules = (props.pricing.pricing_rules ?? {}) as { bulkTiers?: { minQty: number; discountPct: number }[] };
    const tiers = (rules.bulkTiers ?? []).slice().sort((a, b) => a.minQty - b.minQty);
    const next = tiers.find((t) => quantity < t.minQty && t.discountPct > priceMeta.discountPct);
    return next ? { add: next.minQty - quantity, pct: next.discountPct } : null;
  }, [props.pricing.pricing_rules, quantity, priceMeta.discountPct]);

  // Estimated in-hands window for an order placed today (shared with checkout
  // review so both screens project the same date).
  const inHands = useMemo(() => inHandsWindow(new Date(), props.leadTimeDays), [props.leadTimeDays]);

  const colorwayId = useRef(edit?.extraColorways.length ?? 0);
  const usedColours = new Set(colourwayList.map((c) => c.colourName));
  function addColorway() {
    const next = props.colours.find((c) => !usedColours.has(c.name)) ?? props.colours[0];
    if (!next) return;
    setExtraColorways((rows) => [...rows, { id: `cw-${colorwayId.current++}`, colourName: next.name, sizeQty: {} }]);
  }
  function removeColorway(id: string) {
    setExtraColorways((rows) => rows.filter((r) => r.id !== id));
  }
  function setColorwayColour(id: string, name: string) {
    setExtraColorways((rows) => rows.map((r) => (r.id === id ? { ...r, colourName: name } : r)));
  }
  function setColorwaySize(id: string, size: string, val: number) {
    setExtraColorways((rows) => rows.map((r) => (r.id === id ? { ...r, sizeQty: { ...r.sizeQty, [size]: val } } : r)));
  }

  // (Re)load every mounted canvas's garment + print area when the colour changes.
  // Art on each canvas is preserved — only the garment backdrop swaps.
  useEffect(() => {
    setLoadedViews(new Set());
    views.forEach((v) => {
      const c = canvasRefs.current[v];
      if (!c) return;
      c.setGarment(imageForView(colour, v));
      c.setPrintArea(boxForView(v));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colourName]);

  // Keep each Fabric canvas's cached offset in sync with the CSS zoom transform.
  // Also re-measure after a canvas is un-hidden (single<->both / side switch),
  // since a display:none canvas reports a stale/zero offset.
  useEffect(() => {
    requestAnimationFrame(() => views.forEach((v) => canvasRefs.current[v]?.recalcOffset()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, viewMode, activeView]);

  // Undo/redo state reflects whichever canvas is currently active.
  useEffect(() => {
    setCanUndo((histories.current[activeView]?.length ?? 0) > 0);
    setCanRedo((futures.current[activeView]?.length ?? 0) > 0);
  }, [activeView]);

  function refreshUndo(v: View) {
    setCanUndo((histories.current[v]?.length ?? 0) > 0);
    setCanRedo((futures.current[v]?.length ?? 0) > 0);
  }

  /** Focus a canvas (tool target) and scroll it into view. */
  function focusView(v: View) {
    setActiveView(v);
    stageRefs.current[v]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  /** Switch single/both view mode, picking a zoom that fits. */
  function setMode(m: "single" | "both") {
    setViewMode(m);
    setZoom(m === "both" ? 0.75 : 1);
  }

  /** In single mode, show one side and make it the tool target. */
  function showSide(v: View) {
    setMode("single");
    focusView(v);
  }

  function snapshot(v: View) {
    const c = canvasRefs.current[v];
    if (!c) return;
    (histories.current[v] ??= []).push(c.exportScene());
    if (histories.current[v].length > 30) histories.current[v].shift();
    futures.current[v] = [];
    refreshUndo(v);
  }

  function undo() {
    const v = activeView;
    const c = canvasRefs.current[v];
    const hist = histories.current[v];
    if (!c || !hist || hist.length === 0) return;
    (futures.current[v] ??= []).push(c.exportScene());
    c.loadScene(hist.pop()!);
    setSelection(null);
    onCanvasChange(v);
    refreshUndo(v);
  }

  function redo() {
    const v = activeView;
    const c = canvasRefs.current[v];
    const fut = futures.current[v];
    if (!c || !fut || fut.length === 0) return;
    (histories.current[v] ??= []).push(c.exportScene());
    c.loadScene(fut.pop()!);
    setSelection(null);
    onCanvasChange(v);
    refreshUndo(v);
  }

  /** Recompute whether a given view has artwork (and whether any spills out). */
  function onCanvasChange(v: View) {
    const c = canvasRefs.current[v];
    if (!c) return;
    const has = c.hasObjects();
    setViewsWithArt((prev) => {
      const next = new Set(prev);
      if (has) next.add(v);
      else next.delete(v);
      return next;
    });
    // An empty view can't be out of bounds; otherwise ask the canvas.
    const outside = has && c.artOutsidePrintArea();
    setOutOfBounds((prev) => {
      if (outside === prev.has(v)) return prev;
      const next = new Set(prev);
      if (outside) next.add(v);
      else next.delete(v);
      return next;
    });
  }

  // Saved-design rehydration: each view's art is loaded into its canvas once,
  // after the garment image is ready (so the print rect is in place). We pull
  // from the ref and delete the entry so later colour swaps don't reload it.
  const pendingScenes = useRef<Record<string, object>>(edit?.scenes ?? {});
  async function loadInitialScene(v: View) {
    const scene = pendingScenes.current[v];
    if (!scene) return;
    delete pendingScenes.current[v];
    const c = canvasRefs.current[v];
    if (!c) return;
    await c.loadScene(scene);
    onCanvasChange(v);
  }

  function onSelectionChange(v: View, has: boolean) {
    if (has) setActiveView(v);
    setSelection((prev) => (has ? { view: v } : prev?.view === v ? null : prev));
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = activeView;
    snapshot(v);
    const id = crypto.randomUUID();
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await canvasRefs.current[v]?.addImageFromUrl(dataUrl);
      artworkFiles.current.push({ id, file });
      onCanvasChange(v);
      // Heads-up if a raster upload is small for large-format printing. Vectors
      // (SVG/PDF) scale cleanly, so skip them.
      if (/^image\/(png|jpe?g)/.test(file.type)) {
        const probe = new window.Image();
        probe.onload = () => {
          const min = Math.min(probe.naturalWidth, probe.naturalHeight);
          setLowResNote(min < 1200 ? `${probe.naturalWidth} × ${probe.naturalHeight}px` : null);
        };
        probe.src = dataUrl;
      } else {
        setLowResNote(null);
      }
    };
    reader.readAsDataURL(file);
  }

  function addText() {
    // Add an editable text object; the customer double-clicks on the canvas to edit it.
    const v = activeView;
    snapshot(v);
    canvasRefs.current[v]?.addText("Your text");
    onCanvasChange(v);
  }

  async function addClipart(svg: string) {
    const v = activeView;
    snapshot(v);
    await canvasRefs.current[v]?.addImageFromUrl(svgToDataUrl(svg));
    onCanvasChange(v);
  }

  function applyTextColor(hex: string) {
    setTextColor(hex);
    const v = selection?.view ?? activeView;
    canvasRefs.current[v]?.setActiveColor(hex);
  }

  function layer(dir: "forward" | "back") {
    const v = selection?.view ?? activeView;
    const c = canvasRefs.current[v];
    if (!c) return;
    if (dir === "forward") c.bringForward();
    else c.sendBackward();
  }

  function deleteActive() {
    const v = selection?.view ?? activeView;
    snapshot(v);
    canvasRefs.current[v]?.deleteActive();
    setSelection(null);
    onCanvasChange(v);
  }

  async function stageUploads(items: { id: string; bucket: string; name: string; kind: string; blob: Blob }[]) {
    if (items.length === 0) return {} as Record<string, { bucket: string; path: string }>;
    const res = await fetch("/api/design/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: items.map((i) => ({ id: i.id, bucket: i.bucket, name: i.name, kind: i.kind, size: i.blob.size })) }),
    });
    if (!res.ok) throw new Error("Upload preparation failed");
    const { uploads } = (await res.json()) as { uploads: { id: string; bucket: string; path: string; token: string }[] };
    const supabase = createSupabaseBrowserClient();
    const map: Record<string, { bucket: string; path: string }> = {};
    for (const u of uploads) {
      const item = items.find((i) => i.id === u.id)!;
      const { error: upErr } = await supabase.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, item.blob, {
        contentType: item.blob.type || "application/octet-stream",
      });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      map[u.id] = { bucket: u.bucket, path: u.path };
    }
    return map;
  }

  function dataUrlToBlob(dataUrl: string): Blob {
    const [head, b64] = dataUrl.split(",");
    const mime = /:(.*?);/.exec(head)?.[1] ?? "image/png";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /** Design -> review. Requires at least one decorated side before continuing. */
  function goToReview() {
    setError(null);
    const artView = views.find((v) => canvasRefs.current[v]?.hasObjects());
    if (!artView) {
      setError("Add some artwork or text to your design first.");
      return;
    }
    setPreviewUrl(canvasRefs.current[artView]?.exportMockup() ?? null);
    setPhase("review");
  }

  /**
   * Persist the current design as a draft, then route on. "cart" adds the saved
   * design to the lite cart (carrying the name + lead email from the save modal)
   * and sends the customer to /cart; "designs" parks the draft in My Designs. The
   * actual Order is NOT created here — it's placed from the cart at checkout.
   */
  async function saveDesign(
    destination: "cart" | "designs",
    extras?: { name?: string; leadEmail?: string }
  ) {
    setError(null);
    setSaveError(null);
    // Route errors to the modal when we're in the add-to-cart flow, else inline.
    const reportErr = (msg: string) => {
      if (destination === "cart") setSaveError(msg);
      else setError(msg);
    };
    // "Save & share" parks the draft in My Designs, which needs an account.
    // "Add to cart" allows guests (they save with just an email + cookie).
    if (!props.isLoggedIn && destination === "designs") {
      router.push(`/login?next=${encodeURIComponent(`/design/${props.productId}`)}`);
      return;
    }
    if (destination === "cart" && quantity < 1) {
      setSaveError("Add at least one size & quantity first.");
      return;
    }
    // Snapshot every canvas; figure out which views actually carry art.
    const allScenes: Record<string, object> = {};
    const viewsArt: View[] = [];
    for (const v of views) {
      const c = canvasRefs.current[v];
      if (!c) continue;
      allScenes[v] = c.exportScene();
      if (c.hasObjects()) viewsArt.push(v);
    }
    if (viewsArt.length === 0) {
      reportErr("Add some artwork or text to your design first.");
      return;
    }

    setBusy(destination === "cart" ? "submit" : "save");
    try {
      // Export one mockup per decorated view (front + back proofs).
      const uploadItems: { id: string; bucket: string; name: string; kind: string; blob: Blob }[] = [];
      const mockupViews: View[] = [];
      for (const v of viewsArt) {
        const data = canvasRefs.current[v]?.exportMockup();
        if (data) {
          uploadItems.push({ id: "mockup-" + v, bucket: "designs", name: `mockup-${v}.png`, kind: "mockup", blob: dataUrlToBlob(data) });
          mockupViews.push(v);
        }
      }
      for (const af of artworkFiles.current) {
        uploadItems.push({ id: af.id, bucket: "artwork", name: af.file.name, kind: "artwork", blob: af.file });
      }
      const staged = await stageUploads(uploadItems);

      const mockups = mockupViews.map((v) => ({ view: v, bucket: "designs", path: staged["mockup-" + v].path }));
      const artwork = artworkFiles.current
        .filter((af) => staged[af.id])
        .map((af) => ({ name: af.file.name, bucket: "artwork", path: staged[af.id].path }));

      const input: DesignSubmitInput = {
        productId: props.productId,
        designId: edit?.designId,
        name: extras?.name,
        leadEmail: extras?.leadEmail,
        colourName,
        colourHex: colour?.hex,
        // Per-size breakdown of the primary colour (first colourway).
        sizeQuantities: sizeQty,
        // Every colourway with quantity — one order line item each.
        colorways: pricedColorways
          .filter((c) => c.quantity > 0)
          .map((c) => ({
            colourName: c.colourName,
            colourHex: c.hex ?? undefined,
            sizeQuantities: c.sizeQty,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
            lineTotal: c.lineTotal,
          })),
        decorationMethodId: methodId,
        printAreaIds: viewsArt.map((v) => printAreaForView(v)?.id).filter(Boolean) as string[],
        scenes: allScenes,
        mockups,
        artwork,
        priceSnapshot: {
          unitPrice: breakdown.unitPrice,
          subtotal: breakdown.subtotal,
          setupTotal: breakdown.setupTotal,
          total: breakdown.total,
          quantity,
          rush,
        },
        asQuote: true,
      };

      const res = await saveDraftAction(input);
      if (res.needsLogin) {
        router.push(`/login?next=${encodeURIComponent(`/design/${props.productId}`)}`);
        return;
      }
      if (res.error) {
        reportErr(res.error);
        return;
      }
      if (res.designId) {
        if (destination === "cart") {
          // Summarize colourways for the cart row, then drop it in and head to
          // the cart. Same artwork, possibly several garment colours.
          const activeColorways = pricedColorways.filter((c) => c.quantity > 0);
          const colourSummary =
            activeColorways.length > 1
              ? `${activeColorways.length} colours · ${quantity} pcs`
              : `${activeColorways[0]?.colourName ?? colourName} · ${quantity} pcs`;
          addItem({
            designId: res.designId,
            productId: props.productId,
            productName: extras?.name?.trim() || props.productName,
            colourSummary,
            quantity,
            total: breakdown.total,
            mockupUrl: previewUrl,
            addedAt: Date.now(),
          });
          router.push("/cart");
        } else {
          router.push("/account/designs");
        }
      }
    } catch (e) {
      reportErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const zoomIdx = ZOOM_STEPS.indexOf(zoom) === -1 ? 3 : ZOOM_STEPS.indexOf(zoom);
  // Sides that actually carry art — listed in the review spec table.
  const decoratedViews = views.filter((v) => viewsWithArt.has(v));
  // Any decorated side with art spilling past the print box (drives the review
  // heads-up). Informational only — never gates checkout.
  const anyOutOfBounds = decoratedViews.some((v) => outOfBounds.has(v));
  // Embroidery is decorated in thread; screen print / DTG in ink. Label the
  // colour count accordingly so the spec reads in the customer's terms.
  const isEmbroidery = (method?.name ?? "").toLowerCase().includes("embroid");
  const colourKindLabel = isEmbroidery ? "Thread colours" : "Ink colours";

  return (
    <div className="bg-dream-lavender-soft text-dream-ink">
      {/* App screen — exactly one viewport tall; each column scrolls on its own.
          The shirt-details section + footer below sit in normal page flow, so
          the whole page scrolls past the editor to reveal them. */}
      <div className="flex h-dvh flex-col overflow-hidden">
        {/* Site nav — same chrome as the rest of the store */}
        <div className="shrink-0 bg-dream-lavender-soft">
          <SiteNav />
        </div>

      {/* Full-bleed work area. Stays mounted (hidden) during the review phase so
          the canvases keep their artwork for mockup export. */}
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden", phase !== "design" && "hidden")}>
        {/* Left — clean white column: flat icon rail + product/tools panel.
            Collapses to just the rail (lg:w-20) when leftOpen is false. */}
        <aside
          className={cn(
            "flex shrink-0 bg-white transition-[width] duration-200 lg:overflow-hidden lg:border-r lg:border-dream-line",
            leftOpen ? "lg:w-[23rem]" : "lg:w-20"
          )}
        >
          {/* Vertical icon rail */}
          <div className="flex shrink-0 flex-row items-center gap-5 border-b border-dream-line px-3 py-3 lg:w-20 lg:flex-col lg:gap-9 lg:border-b-0 lg:border-r lg:py-7">
            {/* Single panel toggle — pinned to the top of the always-visible rail,
                same spot whether open or closed; the chevron just flips. */}
            <button
              onClick={() => setLeftOpen((o) => !o)}
              aria-label={leftOpen ? "Hide panel" : "Show panel"}
              aria-expanded={leftOpen}
              className="flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-dream-lavender-soft text-dream-purple">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn("transition-transform", !leftOpen && "rotate-180")}
                >
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </span>
              <span className="text-[11px] font-semibold text-dream-ink">{leftOpen ? "Hide" : "Show"}</span>
            </button>
            <Link
              href={`/shop/${props.productId}`}
              className="flex flex-col items-center gap-2 text-dream-purple transition-transform hover:-translate-y-0.5"
            >
              <BackArrowIcon />
              <span className="text-[11px] font-semibold text-dream-ink">Back</span>
            </Link>
            {TOOLS.map((t) => {
              const isActive = tool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTool(t.id);
                    setLeftOpen(true);
                  }}
                  aria-pressed={isActive}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 transition-transform hover:-translate-y-0.5",
                    isActive && "h-14 w-14 rounded-lg bg-dream-ink shadow-[0_4px_10px_-8px_rgba(27,20,88,0.4)]"
                  )}
                >
                  <Image
                    src={t.icon}
                    alt=""
                    width={20}
                    height={20}
                    className={cn("h-5 w-auto", isActive && "[filter:brightness(0)_invert(1)]")}
                  />
                  <span className={cn("font-semibold", isActive ? "text-[10px] text-white" : "text-[11px] text-dream-ink")}>
                    {t.label}
                  </span>
                </button>
              );
            })}
            <div className="hidden lg:block lg:flex-1" />
            <Link
              href="/account/help"
              className="flex flex-col items-center gap-2 text-dream-purple transition-transform hover:-translate-y-0.5"
            >
              <SupportIcon />
              <span className="text-[11px] font-semibold text-dream-ink">Support</span>
            </Link>
          </div>

          {/* Panel — scrolls within the fixed-height aside; hidden when collapsed */}
          <div className={cn("no-scrollbar min-w-0 flex-1 overflow-y-auto p-5 lg:p-6", !leftOpen && "hidden")}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dream-purple">Garment</div>
            <h2 className="mt-1 font-display text-base font-extrabold leading-snug text-dream-ink">{props.productName}</h2>
            {sizeRange && <p className="mt-1 text-xs text-dream-muted">Sizes {sizeRange}</p>}

            <div className="mt-4 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-dream-muted">Colour</span>
              <span className="truncate text-xs font-bold text-dream-purple">{colourName || "Pick one"}</span>
            </div>
            <div className="no-scrollbar mt-3 grid max-h-44 grid-cols-6 gap-x-2 gap-y-2.5 overflow-y-auto px-2.5 py-2.5">
              {props.colours.map((c) => {
                const selected = colourName === c.name;
                return (
                  <button
                    key={c.name}
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={selected}
                    onClick={() => setColourName(c.name)}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple",
                      selected && "scale-105"
                    )}
                  >
                    {/* swatch face with an inset ring so white/light colours stay visible */}
                    <span
                      className={cn(
                        "h-full w-full rounded-full ring-1 ring-inset ring-dream-ink/15 transition-shadow",
                        selected && "ring-2 ring-dream-purple"
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                    {/* selected check — drops a contrasting tick on the chosen swatch */}
                    {selected && (
                      <svg
                        viewBox="0 0 24 24"
                        className="pointer-events-none absolute h-3.5 w-3.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5 13 4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <hr className="my-6 border-dream-line" />

            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dream-purple">Design tools</div>

            {/* Selected tool's content — the tool is chosen from the icon rail. */}
            <div className="mt-3 rounded-2xl bg-dream-cream/60 p-4">
              {tool === "upload" && (
                <>
                  <h3 className="font-display text-base font-bold text-dream-ink">Upload artwork</h3>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-dream-line-strong px-3 py-7 text-center transition-colors hover:border-dream-purple hover:bg-white/70"
                  >
                    <Image src="/designer/upload.svg" alt="" width={26} height={26} className="h-6 w-auto" />
                    <span className="text-sm font-bold text-dream-ink">Drop a file or click to browse</span>
                    <span className="text-xs text-dream-faint">PNG, SVG, JPG, PDF up to 25 MB</span>
                  </button>
                  {lowResNote && (
                    <p className="mt-3 rounded-lg bg-dream-sun/25 px-3 py-2 text-xs leading-relaxed text-dream-ink">
                      Heads up, that file is {lowResNote}, a bit low-res for large prints. No worries, we&apos;ll clean it up or vectorize it for you, free.
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-dream-faint">
                    Not print-ready? We&apos;ll vectorize or touch up your art for print, free.
                  </p>
                  {(() => {
                    const pa = printAreaForView(activeView);
                    return pa?.maxWidthIn && pa?.maxHeightIn ? (
                      <p className="mt-2 text-xs leading-relaxed text-dream-faint">
                        {VIEW_LABEL[activeView]} prints up to {pa.maxWidthIn} × {pa.maxHeightIn} in.
                      </p>
                    ) : null;
                  })()}
                </>
              )}

              {tool === "text" && (
                <>
                  <h3 className="font-display text-base font-bold text-dream-ink">Add text</h3>
                  <button
                    onClick={addText}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dream-line bg-white px-3 py-3 text-sm font-semibold text-dream-ink transition-colors hover:border-dream-purple"
                  >
                    <Image src="/designer/tool-text.svg" alt="" width={16} height={16} className="h-4 w-auto" />
                    Add a text box
                  </button>
                  <div className="mt-3 text-xs font-medium text-dream-muted">Text colour</div>
                  <div className="mt-2 grid grid-cols-8 gap-1.5">
                    {TEXT_COLORS.map((hex) => {
                      const selected = textColor.toLowerCase() === hex;
                      return (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => applyTextColor(hex)}
                          aria-label={hex}
                          aria-pressed={selected}
                          title={hex}
                          className={cn(
                            "aspect-square rounded-full transition-transform hover:scale-110",
                            selected ? "ring-2 ring-dream-purple" : "ring-1 ring-inset ring-dream-ink/15"
                          )}
                          style={{ backgroundColor: hex }}
                        />
                      );
                    })}
                    {/* Custom colour — opens the native picker for anything else. */}
                    <label
                      title="Custom colour"
                      className={cn(
                        "relative aspect-square cursor-pointer rounded-full transition-transform hover:scale-110",
                        TEXT_COLORS.includes(textColor.toLowerCase()) ? "ring-1 ring-inset ring-dream-ink/15" : "ring-2 ring-dream-purple"
                      )}
                      style={{ background: "conic-gradient(from 0deg, #ef4444, #facc15, #16a34a, #38bdf8, #7c3aed, #ec4899, #ef4444)" }}
                    >
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => applyTextColor(e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="Custom text colour"
                      />
                    </label>
                  </div>
                </>
              )}

              {tool === "clipart" && (
                <>
                  <h3 className="font-display text-base font-bold text-dream-ink">Clip art</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {CLIPART.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => addClipart(c.svg)}
                        title={c.name}
                        className="flex aspect-square items-center justify-center rounded-xl border border-dream-line bg-white p-2.5 transition-colors hover:border-dream-purple [&>svg]:h-full [&>svg]:w-auto"
                        dangerouslySetInnerHTML={{ __html: c.svg }}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-dream-faint">Tap a graphic to drop it on, then drag to place it.</p>
                </>
              )}
            </div>

            {/* Print method */}
            {props.methods.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dream-purple">Print method</div>
                <div className="mt-3 space-y-1.5">
                  {props.methods.map((m) => (
                    <label
                      key={m.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                        methodId === m.id
                          ? "border-dream-purple bg-dream-lavender-soft text-dream-ink"
                          : "border-dream-line hover:border-dream-line-strong"
                      )}
                    >
                      <input type="radio" name="method" className="accent-dream-purple" checked={methodId === m.id} onChange={() => setMethodId(m.id)} />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,application/pdf"
              hidden
              onChange={onPickFile}
            />
          </div>
        </aside>

        {/* Center — grid-backed canvas stage (full bleed) */}
        <main className="relative flex min-h-[60vh] flex-1 flex-col overflow-hidden lg:min-h-0" style={GRID_BG}>
          {/* Floating top bar */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex items-center justify-between px-4">
            <span className={cn(GLASS, "pointer-events-auto px-3 py-1.5 font-display text-xs font-bold text-dream-ink")}>
              {views.length <= 1
                ? "Design preview"
                : viewMode === "both"
                  ? "Front & back"
                  : `Editing the ${VIEW_LABEL[activeView].toLowerCase()}`}
            </span>
            <div className="pointer-events-auto flex items-center gap-2">
              <div className={cn(GLASS, "inline-flex items-center gap-0.5 p-1")}>
                <IconBtn label="Zoom out" disabled={zoomIdx <= 0} onClick={() => setZoom(ZOOM_STEPS[Math.max(0, zoomIdx - 1)])}>
                  <MinusIcon />
                </IconBtn>
                <button onClick={() => setZoom(1)} className="min-w-[3rem] rounded-full px-2 text-xs font-semibold text-dream-muted hover:text-dream-ink">
                  {Math.round(zoom * 100)}%
                </button>
                <IconBtn label="Zoom in" disabled={zoomIdx >= ZOOM_STEPS.length - 1} onClick={() => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIdx + 1)])}>
                  <PlusIcon />
                </IconBtn>
              </div>
              <div className={cn(GLASS, "inline-flex items-center gap-0.5 p-1")}>
                <IconBtn label="Undo" disabled={!canUndo} onClick={undo}>
                  <UndoIcon />
                </IconBtn>
                <IconBtn label="Redo" disabled={!canRedo} onClick={redo}>
                  <RedoIcon />
                </IconBtn>
              </div>
            </div>
          </div>

          {/* Canvases — every decorated side side by side, each editable. The
              active one is ringed; clicking a canvas makes it the tool target. */}
          <div className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-5 overflow-auto p-4 pt-16 pb-20">
            {views.map((v) => {
              const isActive = viewMode === "both" && views.length > 1 && v === activeView;
              const loading = !loadedViews.has(v);
              // In single mode only the active side is shown; the others stay
              // mounted (so their art is preserved + still exports) but hidden.
              const hidden = viewMode === "single" && v !== activeView;
              return (
                <div
                  key={v}
                  ref={(el) => {
                    stageRefs.current[v] = el;
                  }}
                  onMouseDown={() => setActiveView(v)}
                  className={cn("flex shrink-0 flex-col items-center", hidden && "hidden")}
                >
                  {viewMode === "both" && views.length > 1 && (
                    <span
                      className={cn(
                        "mb-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors",
                        isActive ? "bg-dream-ink text-white" : "bg-white text-dream-muted ring-1 ring-dream-ink/10"
                      )}
                    >
                      {VIEW_LABEL[v]}
                    </span>
                  )}
                  <div className={cn("relative w-fit rounded-2xl bg-white ring-1 ring-dream-ink/[0.05] p-2 transition-shadow sm:p-2.5", isActive && "ring-2 ring-dream-purple")}>
                    <div
                      className="mx-auto w-fit transition-transform duration-150"
                      style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                    >
                      <DesignCanvas
                        ref={(h) => {
                          canvasRefs.current[v] = h;
                        }}
                        onSelectionChange={(has) => onSelectionChange(v, has)}
                        onChange={() => onCanvasChange(v)}
                        onGarmentLoaded={() => {
                          setLoadedViews((s) => new Set(s).add(v));
                          // Recompute art-vs-box now that the print rect is
                          // redrawn against the (possibly new-aspect) garment.
                          // loadInitialScene re-checks again once a saved scene
                          // finishes loading; both paths are idempotent.
                          loadInitialScene(v);
                          onCanvasChange(v);
                        }}
                      />
                    </div>

                    {/* Loading shimmer */}
                    {loading && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60">
                        <span className="h-8 w-8 animate-spin rounded-full border-2 border-dream-line border-t-dream-purple" />
                      </div>
                    )}

                    {/* Out-of-bounds heads-up — subtle, non-blocking. Never
                        intercepts canvas clicks (pointer-events-none). */}
                    {!loading && outOfBounds.has(v) && (
                      <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 w-[min(20rem,90%)] -translate-x-1/2">
                        <div className="flex items-start gap-2 rounded-2xl bg-dream-sun/90 px-3 py-2 text-left ring-1 ring-dream-ink/10 backdrop-blur-sm">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-dream-ink" aria-hidden>
                            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                          </svg>
                          <p className="text-[11px] font-semibold leading-snug text-dream-ink">
                            Part of your design sits outside the dashed print lines. You can still order — a real person double-checks every design before we print.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating bottom bar — side switch (left) + selected-object actions */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-wrap items-center justify-start gap-2 px-4">
            {/* Side switch — pick which side to design; "See both" shows them together */}
            {views.length > 1 && (
              <div className={cn(GLASS, "pointer-events-auto inline-flex items-center gap-1 p-1.5")}>
                {views.map((v) => {
                  const on = viewMode === "single" && v === activeView;
                  return (
                    <button
                      key={v}
                      onClick={() => showSide(v)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full px-4 py-2 text-[13px] font-bold transition-colors",
                        on ? "bg-dream-ink text-white" : "text-dream-muted hover:text-dream-ink"
                      )}
                    >
                      {VIEW_LABEL[v]}
                    </button>
                  );
                })}
                <span aria-hidden className="mx-1 h-6 w-px bg-dream-line" />
                <button
                  onClick={() => setMode(viewMode === "both" ? "single" : "both")}
                  aria-pressed={viewMode === "both"}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                    viewMode === "both" ? "bg-dream-purple text-white" : "text-dream-muted hover:text-dream-ink"
                  )}
                >
                  See both
                </button>
              </div>
            )}
            {selection && (
              <div className={cn(GLASS, "pointer-events-auto inline-flex items-center gap-1.5 p-1.5")}>
                <ChipBtn onClick={() => layer("forward")}>Forward</ChipBtn>
                <ChipBtn onClick={() => layer("back")}>Back</ChipBtn>
                <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-dream-line bg-white" title="Text colour">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => applyTextColor(e.target.value)}
                    className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  />
                </label>
                <ChipBtn onClick={deleteActive}>Delete</ChipBtn>
              </div>
            )}
          </div>
        </main>
        </div>

        {/* Design footer — pricing & quantity live on the review screen; this advances to it */}
        {phase === "design" && (
          <div className="shrink-0 border-t border-dream-line bg-white px-4 py-3">
            <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <p className={cn("hidden truncate text-sm sm:block", error ? "font-medium text-dream-danger" : "text-dream-muted")}>
                  {error ?? "Looking good! Set your quantity and see pricing next."}
                </p>
                <button
                  onClick={goToReview}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-dream-purple px-7 py-3 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                >
                  Continue
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review screen — scrollable content above a sticky checkout bar */}
        {phase === "review" && (
          <div className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Progress — full-width above the two columns so the customer knows
                where they are and that payment comes only after they approve. */}
            <div className="border-b border-dream-line bg-dream-cream/60">
              <ReviewStepper className="mx-auto max-w-6xl px-4 py-3.5 sm:px-6 lg:px-8" />
            </div>
            {/* Item (left) + details (right). The preview fills the left region
                and is top-aligned + sticky so it stays put while the form on the
                right grows/scrolls (typing a quantity no longer shifts it). */}
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 pb-20 sm:px-6 lg:flex-row lg:items-start lg:gap-12 lg:px-8 lg:pt-12 lg:pb-28">
              {/* Preview — centered in the left region, pinned in place. The
                  back button sits at its top-left corner. */}
              <div className="relative flex min-h-[260px] items-center justify-center self-stretch p-3 lg:sticky lg:top-12 lg:min-h-[60vh] lg:flex-1 lg:self-start lg:pr-16">
                <button
                  onClick={() => setPhase("design")}
                  className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 font-display text-sm font-bold text-dream-ink transition-colors hover:text-dream-purple lg:-left-2 lg:top-0"
                >
                  <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
                  Back to designing
                </button>
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Your design" className="max-h-[60vh] w-auto max-w-full object-contain" />
                ) : (
                  <span className="text-sm text-dream-muted">Preview unavailable</span>
                )}
              </div>

              {/* Details — a fixed-width form column on the right. */}
              <div className="w-full lg:w-[34rem] lg:shrink-0">
                {/* Decoration spec — what's printed, where, and in how many colours.
                    "Colours" reads as thread (embroidery) or ink (print). */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-dream-purple">What we&apos;re printing</div>
                    <span className="text-xs font-semibold text-dream-muted">
                      {decoratedViews.length} {decoratedViews.length === 1 ? "location" : "locations"}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-dream-line">
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-x-3 bg-dream-cream px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-dream-muted">
                      <span>Location</span>
                      <span>Method</span>
                      <span className="text-right">{colourKindLabel}</span>
                    </div>
                    {decoratedViews.map((v) => (
                      <div
                        key={v}
                        className="border-t border-dream-line px-4 py-3.5 text-sm text-dream-ink first:border-t-0"
                      >
                        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-x-3">
                          <span className="font-semibold">{VIEW_LABEL[v]}</span>
                          <span className="text-dream-ink-soft">{method?.name ?? "Print"}</span>
                          <span className="justify-self-end rounded-full bg-dream-lavender-soft px-2.5 py-0.5 text-xs font-bold text-dream-purple">
                            {inkColours} {isEmbroidery ? "thread" : "ink"}
                          </span>
                        </div>
                        {outOfBounds.has(v) && (
                          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-dream-warn-soft px-2.5 py-1.5 text-xs font-medium leading-snug text-dream-warn">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0" aria-hidden>
                              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                            </svg>
                            Art extends past the print area — we&apos;ll double-check it with you.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <hr className="my-8 border-dream-line" />
                {/* Colours & sizes — one block per garment colourway. Same artwork,
                    different shirt colours; each colour is priced on its own qty. */}
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-dream-purple">Colours &amp; sizes</div>
                    <p className="mt-1.5 text-sm leading-relaxed text-dream-muted">How many of each size? Need another shirt colour? Add one below.</p>
                  </div>

                  <ColorwayBlock
                    hex={colour?.hex ?? null}
                    name={colourName}
                    sizes={props.sizes}
                    sizeQty={sizeQty}
                    onSize={(size, val) => setSizeQty((q) => ({ ...q, [size]: val }))}
                    pricing={pricedColorways[0]}
                  />

                  {extraColorways.map((cw, i) => (
                    <ColorwayBlock
                      key={cw.id}
                      hex={props.colours.find((c) => c.name === cw.colourName)?.hex ?? null}
                      name={cw.colourName}
                      colours={props.colours}
                      onColour={(name) => setColorwayColour(cw.id, name)}
                      onRemove={() => removeColorway(cw.id)}
                      sizes={props.sizes}
                      sizeQty={cw.sizeQty}
                      onSize={(size, val) => setColorwaySize(cw.id, size, val)}
                      pricing={pricedColorways[i + 1]}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={addColorway}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-dream-purple/50 px-4 py-3 font-display text-sm font-bold text-dream-purple transition-colors hover:bg-dream-lavender-soft"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
                    Add another colour
                  </button>
                </div>

                {/* Estimate — same grounded price box as the product page's
                    instant estimate: per-unit (with bulk savings) + est. total. */}
                <div className="mt-6 rounded-2xl border border-dream-lavender-soft bg-dream-lavender-mist px-5 py-4.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-dream-purple-dark/70">Your price</p>
                      <p className="font-display text-3xl font-extrabold leading-none text-dream-purple-dark">
                        {formatCAD(breakdown.unitPrice)}
                        <span className="ml-1 text-sm font-semibold text-dream-purple-dark/60">/unit</span>
                      </p>
                      {priceMeta.discountPct > 0 && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                          <span className="text-dream-muted line-through">{formatCAD(priceMeta.anchorPerUnit)}</span>
                          <span className="rounded-full bg-dream-sun px-2 py-0.5 font-bold text-dream-ink">Save {priceMeta.discountPct}%</span>
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-dream-purple-dark/70">
                        {quantity || 0} unit{quantity === 1 ? "" : "s"}
                      </p>
                      <p className="font-display text-xl font-bold leading-none text-dream-ink">{formatCAD(breakdown.total)}</p>
                      <p className="mt-1.5 text-xs text-dream-muted">est. total</p>
                    </div>
                  </div>
                  {breakdown.setupTotal > 0 && (
                    <p className="mt-2.5 border-t border-dream-lavender-soft pt-2 text-[11px] font-semibold text-dream-muted">
                      incl. {formatCAD(breakdown.setupTotal)} one-time setup
                    </p>
                  )}
                  {nextTier && quantity > 0 && (
                    <p className="mt-2.5 flex items-center gap-1.5 border-t border-dream-lavender-soft pt-2 text-xs font-bold text-dream-ink">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-dream-purple" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                      Add {nextTier.add} more to save {nextTier.pct}% per unit
                    </p>
                  )}
                </div>

                {/* Estimated delivery — one confident in-hands date (shared math
                    with checkout so the two screens never disagree). */}
                <div className="mt-6 flex items-start gap-4 rounded-2xl border border-dream-line bg-white px-5 py-5">
                  <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-dream-cream text-dream-purple">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 19ZM17.5 19a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" /></svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-dream-muted">Estimated delivery</p>
                    <p className="mt-1 font-display text-lg font-bold leading-tight text-dream-ink">In hands by {fmtDate(inHands.end)}</p>
                    <p className="mt-2 text-xs leading-relaxed text-dream-muted">
                      Proof in ~1 business day, then ships once you approve. Dates firm up on your proof.
                    </p>
                  </div>
                </div>

                {/* Reassurance — the risk-reducers a first-time custom buyer
                    weighs right at the decision point. "Pay after approval" is
                    intentionally NOT repeated here (the stepper + CTA carry it). */}
                <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
                  {["Printed right, guaranteed", "Free design proof", "Printed in Canada", "Expert design review"].map((b) => (
                    <div key={b} className="flex items-center gap-2 text-sm font-semibold text-dream-ink">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-dream-success-soft text-dream-success">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                      </span>
                      {b}
                    </div>
                  ))}
                </div>

              </div>
            </div>
            </div>

            {/* Sticky checkout bar — pinned to the bottom of the viewport so the
                CTA is always reachable while the form above scrolls. */}
            <div className="shrink-0 border-t border-dream-line bg-white px-4 py-3 sm:px-6">
              <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                {anyOutOfBounds && !error && (
                  <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-dream-warn sm:mr-auto">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    </svg>
                    Some art sits outside the print lines — we&apos;ll double-check it before printing.
                  </p>
                )}
                <p className={cn("min-w-0 text-sm sm:text-right", error ? "font-medium text-dream-danger" : quantity < 1 ? "text-dream-muted" : "text-dream-faint")}>
                  {error ?? (quantity < 1 ? "Please enter more than 0 items." : "No payment now. We send a proof to approve first.")}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => saveDesign("designs")}
                    disabled={busy !== null}
                    className="inline-flex items-center justify-center rounded-full border border-dream-line bg-white px-5 py-3 font-display text-sm font-bold text-dream-ink transition-colors hover:bg-dream-cream disabled:opacity-60"
                  >
                    {busy === "save" ? "Saving…" : "Save & share"}
                  </button>
                  <button
                    onClick={() => {
                      setSaveError(null);
                      setShowSave(true);
                    }}
                    disabled={busy !== null || quantity < 1}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-dream-purple px-7 py-3 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5.4 8.2c4.4-.5 8.9-.5 13.3 0 .5 3.7.8 7.4.9 11.1-5.1.6-10.2.6-15.2 0 .1-3.7.4-7.4 1-11.1Z" /><path d="M8.6 8c-.2-2 .6-4.2 2.6-4.7 1.7-.4 3.4.6 4 2.2.3.8.3 1.7.2 2.5" /></svg>
                    Add to cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save-your-design gate — names the design + captures a lead email, then
          adds it to the cart. */}
      <Dialog open={showSave} onOpenChange={(o) => { if (busy === null) setShowSave(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader className="px-6 pt-6 pb-1">
            <DialogTitle>Name your design</DialogTitle>
            <DialogDescription>
              Give it a name so you can spot it in your cart, and add your email — we’ll send you a link to pick this design back up, and that’s where your proof will land.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-4">
            <Field label="Design name" htmlFor="design-name" required>
              <Input
                id="design-name"
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                placeholder="e.g. Team hoodies 2026"
                maxLength={80}
              />
            </Field>
            <Field label="Email" htmlFor="lead-email" required>
              <Input
                id="lead-email"
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </Field>
            {saveError && (
              <p className="rounded-xl bg-dream-danger-soft px-3 py-2 text-sm text-dream-danger">{saveError}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
            <button
              onClick={() => setShowSave(false)}
              disabled={busy !== null}
              className="rounded-full px-4 py-2.5 font-display text-sm font-bold text-dream-muted transition-colors hover:text-dream-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const name = designName.trim();
                const email = leadEmail.trim();
                if (!name) { setSaveError("Give your design a name."); return; }
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setSaveError("Enter a valid email."); return; }
                saveDesign("cart", { name, leadEmail: email });
              }}
              disabled={busy !== null}
              className="inline-flex items-center justify-center rounded-full bg-dream-purple px-6 py-2.5 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "submit" ? "Adding…" : "Add to cart"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Three-step progress for the review screen. Frames the journey and signals
 *  up front that payment only comes after the proof is approved. */
function ReviewStepper({ className }: { className?: string }) {
  const steps = [
    { label: "Design", state: "done" as const },
    { label: "Quantity & sizes", state: "current" as const },
    { label: "Approve & pay", state: "upcoming" as const },
  ];
  return (
    <ol className={cn("flex items-center", className)}>
      {steps.map((s, i) => (
        <li key={s.label} className={cn("flex items-center gap-2.5", i < steps.length - 1 && "flex-1")}>
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold",
              s.state === "done" && "bg-dream-ink text-white",
              s.state === "current" && "bg-dream-sun text-dream-ink ring-4 ring-dream-sun/25",
              s.state === "upcoming" && "border border-dream-line-strong bg-white text-dream-muted"
            )}
          >
            {s.state === "done" ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
            ) : (
              i + 1
            )}
          </span>
          <span
            className={cn(
              "whitespace-nowrap text-sm font-bold",
              s.state === "upcoming" ? "text-dream-muted" : "text-dream-ink",
              s.state === "upcoming" && "hidden sm:inline"
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="mx-2 hidden h-px flex-1 bg-dream-line sm:block" />}
        </li>
      ))}
    </ol>
  );
}

/** One garment colourway on the review screen: a colour (static for the primary,
 *  a picker for added ones) + a per-size grid + that colour's running subtotal. */
function ColorwayBlock({
  hex,
  name,
  colours,
  onColour,
  onRemove,
  sizes,
  sizeQty,
  onSize,
  pricing,
}: {
  hex: string | null;
  name: string;
  colours?: ProductColourJson[];
  onColour?: (name: string) => void;
  onRemove?: () => void;
  sizes: { name: string; inStock: boolean }[];
  sizeQty: Record<string, number>;
  onSize: (size: string, val: number) => void;
  pricing?: { quantity: number; unitPrice: number; lineTotal: number };
}) {
  return (
    <div className="rounded-2xl border border-dream-line p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {onColour ? (
            // One cohesive control: swatch + name + chevron read as a single
            // select. The native <select> sits transparently on top for picking.
            <div className="relative min-w-0">
              <div className="flex items-center gap-2 rounded-lg border border-dream-line bg-white py-1.5 pl-2.5 pr-8 transition-colors hover:border-dream-line-strong">
                <span className="h-5 w-5 shrink-0 rounded-full border border-dream-line" style={swatchStyle({ name, hex })} />
                <span className="truncate text-sm font-semibold text-dream-ink">{name}</span>
                <svg
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-dream-muted"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
              <select
                value={name}
                onChange={(e) => onColour(e.target.value)}
                aria-label="Garment colour"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                {colours?.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <span className="h-6 w-6 shrink-0 rounded-full border border-dream-line" style={swatchStyle({ name, hex })} />
              <span className="truncate text-sm font-semibold text-dream-ink">{name}</span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove colour"
              className="flex h-7 w-7 items-center justify-center rounded-full text-dream-muted transition-colors hover:bg-dream-cream hover:text-dream-danger"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>
      {/* Sizes laid out in a single row — label on top, number box below — so
          the whole size run reads and fills at a glance. Scrolls sideways only
          if there are too many sizes for the width. */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {sizes.map((s) => {
          const v = sizeQty[s.name] ?? 0;
          const active = v > 0;
          return (
            <label key={s.name} className="flex min-w-[3rem] flex-1 flex-col items-center gap-1.5">
              <span className="font-display text-xs font-bold text-dream-ink">{s.name}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={v || ""}
                placeholder="0"
                onChange={(e) => onSize(s.name, Math.max(0, Number(e.target.value.replace(/[^0-9]/g, "")) || 0))}
                className={cn(
                  "w-full min-w-0 rounded-lg border-2 bg-white px-1 py-2.5 text-center text-base font-semibold text-dream-ink outline-none transition placeholder:text-dream-ink/30",
                  active ? "border-dream-purple" : "border-dream-ink/25 focus:border-dream-purple"
                )}
              />
            </label>
          );
        })}
      </div>
      {/* Per-colour price math, spelled out: qty x unit = line total. */}
      {pricing && pricing.quantity > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-dream-cream px-4 py-3 text-sm">
          <span className="text-dream-ink-soft">
            <span className="font-bold text-dream-ink">{pricing.quantity}</span>
            {" "}{pricing.quantity === 1 ? "piece" : "pieces"}
            {" "}<span className="text-dream-faint">×</span>{" "}
            <span className="font-semibold text-dream-ink">{formatCAD(pricing.unitPrice)}</span> each
          </span>
          <span className="font-display text-base font-extrabold text-dream-purple">{formatCAD(pricing.lineTotal)}</span>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- bits --------------------------------- */

function ChipBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-dream-line bg-white px-3 py-1.5 text-xs font-medium text-dream-ink transition-colors hover:bg-dream-cream"
    >
      {children}
    </button>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-dream-ink transition-colors hover:bg-dream-cream disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function BackArrowIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </svg>
  );
}
function SupportIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.25" />
      <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 3.7" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
    </svg>
  );
}
function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0 0 10h1" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}
