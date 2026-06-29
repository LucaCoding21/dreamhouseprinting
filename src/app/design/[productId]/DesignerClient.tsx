"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { DesignCanvas, type DesignCanvasHandle, type PrintBox } from "./DesignCanvas";
import { saveDraftAction, type DesignSubmitInput } from "./actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatCAD, roundCents } from "@/lib/money";
import { calcPrice } from "@/lib/pricing/platform";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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

  const [colourName, setColourName] = useState(props.colours[0]?.name ?? "");
  // The canvas that tool actions (upload/text/clip-art/undo) target. The user
  // switches it by clicking a canvas or the "Adding to" pills.
  const [activeView, setActiveView] = useState<View>(views[0] ?? "front");
  const [tool, setTool] = useState<Tool>("upload");
  // Left panel collapse — shrinks the column to just the icon rail.
  const [leftOpen, setLeftOpen] = useState(true);
  // Friendly heads-up when an uploaded raster is a bit low-res for large prints.
  const [lowResNote, setLowResNote] = useState<string | null>(null);
  const [methodId, setMethodId] = useState(props.methods[0]?.id ?? null);
  // Per-size quantity breakdown, collected on the review screen. Total quantity
  // is derived from the sum and drives pricing.
  const [sizeQty, setSizeQty] = useState<Record<string, number>>({});
  // Additional garment colourways for the same artwork — each with its own size
  // breakdown. The primary (canvas) colour + sizeQty is the first colourway;
  // these are the "Add another colour" rows on the review screen.
  const [extraColorways, setExtraColorways] = useState<
    { id: string; colourName: string; sizeQty: Record<string, number> }[]
  >([]);
  // Ink-colour count is determined from the artwork at proofing, not chosen here.
  const inkColours = 1;
  // Rush delivery is disabled for now — the toggle was removed from the review
  // screen. Kept as a const so the pricing/snapshot plumbing stays intact.
  const rush = false;
  const [viewsWithArt, setViewsWithArt] = useState<Set<View>>(new Set());
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
  const [designName, setDesignName] = useState(props.productName);
  const [leadEmail, setLeadEmail] = useState(props.accountEmail ?? "");
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

  const colorwayId = useRef(0);
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

  /** Recompute whether a given view has artwork. */
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
   * Persist the current design as a draft, then route on. "checkout" sends the
   * customer into the checkout funnel carrying the name + lead email collected in
   * the save modal; "designs" parks the draft in My Designs. The actual Order is
   * NOT created here — it's placed at the end of checkout.
   */
  async function saveDesign(
    destination: "checkout" | "designs",
    extras?: { name?: string; leadEmail?: string }
  ) {
    setError(null);
    setSaveError(null);
    // Route errors to the modal when we're in the checkout flow, else inline.
    const reportErr = (msg: string) => {
      if (destination === "checkout") setSaveError(msg);
      else setError(msg);
    };
    // "Save & share" parks the draft in My Designs, which needs an account.
    // "Begin checkout" allows guests (they save with just an email + cookie).
    if (!props.isLoggedIn && destination === "designs") {
      router.push(`/login?next=${encodeURIComponent(`/design/${props.productId}`)}`);
      return;
    }
    if (destination === "checkout" && quantity < 1) {
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

    setBusy(destination === "checkout" ? "submit" : "save");
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
        router.push(destination === "checkout" ? `/checkout/${res.designId}` : "/account/designs");
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

  return (
    <div className="bg-dream-lavender-soft text-dream-ink">
      {/* App screen — exactly one viewport tall; each column scrolls on its own.
          The shirt-details section + footer below sit in normal page flow, so
          the whole page scrolls past the editor to reveal them. */}
      <div className="flex h-dvh flex-col overflow-hidden">
        {/* Site nav + price-match banner — same chrome as the rest of the store */}
        <div className="shrink-0 bg-dream-lavender-soft">
          <SiteNav />
        </div>
      <Link
        href="/contact#coastal-reign"
        className="block shrink-0 bg-[#c6ff3d] text-[#8f55e5] transition hover:brightness-95"
      >
        <p className="mx-auto max-w-[1400px] px-4 py-1.5 text-center text-[12px] font-bold sm:px-6 sm:text-[13px]">
          We price match Coastal Reign and Get Bold! Submit a request and we&apos;ll{" "}
          <span className="font-display font-extrabold uppercase tracking-wide">beat it by 5%</span>
        </p>
      </Link>

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
                      Heads up — that file is {lowResNote}, a bit low-res for large prints. No worries, we&apos;ll clean it up or vectorize it for you, free.
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
                        onGarmentLoaded={() => setLoadedViews((s) => new Set(s).add(v))}
                      />
                    </div>

                    {/* Loading shimmer */}
                    {loading && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60">
                        <span className="h-8 w-8 animate-spin rounded-full border-2 border-dream-line border-t-dream-purple" />
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
            <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
              <p className={cn("truncate text-sm", error ? "text-dream-danger" : "text-dream-muted")}>
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
        )}

        {/* Review screen — quantity, pricing & turnaround, then place the order */}
        {phase === "review" && (
          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            {/* Item (left) + details (right) */}
            <div className="mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:px-8 lg:py-8">
              {/* Preview — compact, not full-width; sits on the white page */}
              <div className="relative flex min-h-[280px] shrink-0 items-center justify-center overflow-hidden p-3 lg:w-[440px]">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Your design" className="max-h-[56vh] w-auto max-w-full object-contain" />
                ) : (
                  <span className="text-sm text-dream-muted">Preview unavailable</span>
                )}
              </div>

              {/* Details — fills the rest of the width out to the right */}
              <div className="flex-1 p-6 sm:p-7 lg:border-l lg:border-dream-line lg:p-8">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPhase("design")}
                    aria-label="Back to design"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-dream-muted transition-colors hover:bg-dream-cream hover:text-dream-ink"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <h2 className="font-display text-lg font-extrabold text-dream-ink">{props.productName}</h2>
                </div>

                <hr className="my-5 border-dream-line" />
                {/* Decoration spec */}
                <div className="overflow-hidden rounded-2xl border border-dream-line">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-x-3 bg-dream-cream px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-dream-muted">
                    <span>Location</span>
                    <span>Type</span>
                    <span>Colours</span>
                  </div>
                  {decoratedViews.map((v) => (
                    <div
                      key={v}
                      className="grid grid-cols-[1fr_1fr_auto] gap-x-3 border-t border-dream-line px-4 py-2.5 text-sm text-dream-ink first:border-t-0"
                    >
                      <span>{VIEW_LABEL[v]}</span>
                      <span>{method?.name ?? "Print"}</span>
                      <span>{inkColours}</span>
                    </div>
                  ))}
                </div>

                <hr className="my-5 border-dream-line" />
                {/* Colours & sizes — one block per garment colourway. Same artwork,
                    different shirt colours; each colour is priced on its own qty. */}
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dream-purple">Colours &amp; sizes</div>

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

                {/* Quantity + total */}
                <div className="mt-5 flex items-end justify-between border-t border-dream-line pt-5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dream-purple">Quantity</div>
                    <div className="font-display text-2xl font-extrabold text-dream-ink">{quantity || 0}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dream-purple">Total</div>
                    <div className="font-display text-2xl font-extrabold text-dream-purple">{formatCAD(breakdown.total)}</div>
                    {breakdown.setupTotal > 0 && (
                      <div className="text-xs text-dream-faint">incl. {formatCAD(breakdown.setupTotal)} setup</div>
                    )}
                  </div>
                </div>

                <hr className="my-5 border-dream-line" />
                {/* CTA */}
                <div className="space-y-3">
                  {error && <p className="rounded-xl bg-dream-danger-soft px-3 py-2 text-sm text-dream-danger">{error}</p>}
                  {quantity < 1 && !error && (
                    <p className="rounded-xl bg-dream-cream px-3 py-2 text-center text-sm text-dream-muted">Please enter more than 0 items.</p>
                  )}
                  <button
                    onClick={() => {
                      setSaveError(null);
                      setShowSave(true);
                    }}
                    disabled={busy !== null || quantity < 1}
                    className="inline-flex w-full items-center justify-center rounded-full bg-dream-purple px-6 py-3.5 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Begin checkout
                  </button>
                  <button
                    onClick={() => saveDesign("designs")}
                    disabled={busy !== null}
                    className="inline-flex w-full items-center justify-center rounded-full border border-dream-line bg-white px-6 py-3 font-display text-sm font-bold text-dream-ink transition-colors hover:bg-dream-cream disabled:opacity-60"
                  >
                    {busy === "save" ? "Saving…" : "Save & share"}
                  </button>
                  <p className="text-center text-xs leading-relaxed text-dream-faint">
                    No payment now. Our team reviews &amp; cleans up your artwork, then sends a proof to approve.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shirt details — full width, below the editor (scroll down to reach it) */}
      <ProductDetails
        productName={props.productName}
        brand={props.brand}
        description={props.description}
        sizeRange={sizeRange}
        colourCount={props.colours.length}
        areaNames={[...new Set(props.printAreas.map((p) => p.name))]}
        methodNames={props.methods.map((m) => m.name)}
        leadTimeDays={props.leadTimeDays}
        stockStatus={props.stockStatus}
      />

      {/* Save-your-design gate — names the design + captures a lead email, then
          sends the customer into checkout. */}
      <Dialog open={showSave} onOpenChange={(o) => { if (busy === null) setShowSave(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save your design</DialogTitle>
            <DialogDescription>
              Name it so you can find it later, and confirm your email. That’s where we’ll send your proof.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 pb-1">
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
          <div className="flex items-center justify-end gap-2 p-5 pt-4">
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
                saveDesign("checkout", { name, leadEmail: email });
              }}
              disabled={busy !== null}
              className="inline-flex items-center justify-center rounded-full bg-dream-purple px-6 py-2.5 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "submit" ? "Saving…" : "Save & continue"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
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
    <div className="rounded-2xl border border-dream-line p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-6 w-6 shrink-0 rounded-full border border-dream-line" style={{ backgroundColor: hex ?? "#e5e7eb" }} />
          {onColour ? (
            <select
              value={name}
              onChange={(e) => onColour(e.target.value)}
              className="min-w-0 rounded-lg border border-dream-line bg-white px-2 py-1.5 text-sm font-semibold text-dream-ink outline-none focus:border-dream-purple"
            >
              {colours?.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate text-sm font-semibold text-dream-ink">{name}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pricing && pricing.quantity > 0 && (
            <span className="text-right text-xs text-dream-faint">
              {pricing.quantity} @ {formatCAD(pricing.unitPrice)} ={" "}
              <span className="font-bold text-dream-ink">{formatCAD(pricing.lineTotal)}</span>
            </span>
          )}
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
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {sizes.map((s) => {
          const v = sizeQty[s.name] ?? 0;
          const active = v > 0;
          return (
            <label
              key={s.name}
              className={cn(
                "flex items-center gap-2 rounded-2xl border-2 bg-white px-3 py-2.5 transition",
                active ? "border-dream-ink shadow-[0_3px_0_0_rgba(27,20,88,0.9)]" : "border-dream-ink/60"
              )}
            >
              <span className="font-display text-sm font-bold text-dream-ink">{s.name}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={v || ""}
                placeholder="0"
                onChange={(e) => onSize(s.name, Math.max(0, Number(e.target.value.replace(/[^0-9]/g, "")) || 0))}
                className="w-full min-w-0 bg-transparent text-right text-base font-semibold text-dream-ink outline-none placeholder:text-dream-ink/30"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ProductDetails({
  productName,
  brand,
  description,
  sizeRange,
  colourCount,
  areaNames,
  methodNames,
  leadTimeDays,
  stockStatus,
}: {
  productName: string;
  brand: string | null;
  description: string | null;
  sizeRange: string | null;
  colourCount: number;
  areaNames: string[];
  methodNames: string[];
  leadTimeDays: number;
  stockStatus: string;
}) {
  const stockLabel =
    stockStatus === "in_stock" ? "In stock" : stockStatus === "out_of_stock" ? "Made to order" : stockStatus.replace(/_/g, " ");
  return (
    <section className="border-t border-dream-line bg-dream-cream/40">
      {/* Extra bottom padding reserves a band for the SiteFooter dog (which pokes
          up out of the footer, right-aligned) so it clears the spec card. */}
      <div className="mx-auto max-w-[1400px] px-6 pt-12 pb-44 lg:px-10 lg:pt-16 lg:pb-60">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dream-purple">Product details</div>
        <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight text-dream-ink lg:text-3xl">{productName}</h2>
        {brand && <p className="mt-1 text-sm font-semibold text-dream-purple">by {brand}</p>}

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
          <p className="max-w-2xl text-[15px] leading-relaxed text-dream-ink-soft">
            {description ||
              "A customer favourite, ready for your custom print. Pick your colour, drop on your artwork, and we'll handle the rest. Need a hand with sizing or placement? We're a message away."}
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 self-start rounded-2xl bg-white p-6 ring-1 ring-dream-ink/5">
            <Spec label="Sizes" value={sizeRange ?? "Standard"} />
            <Spec label="Colours" value={`${colourCount} options`} />
            <Spec label="Print areas" value={areaNames.length ? areaNames.join(", ") : "Front"} />
            <Spec label="Decoration" value={methodNames.length ? methodNames.join(", ") : "Screen print"} />
            <Spec label="Turnaround" value={`${leadTimeDays} business days`} />
            <Spec label="Availability" value={stockLabel} />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-dream-faint">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold capitalize text-dream-ink">{value}</dd>
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
