"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import CartNavButton from "@/components/CartNavButton";
import { AccountIcon } from "@/components/AccountIcon";
import {
  DesignCanvas,
  type DesignCanvasHandle,
  type PrintAreaSpec,
  type ArtMetrics,
} from "./DesignCanvas";
import {
  analyzeImageSource,
  analyzePdfColours,
  formatColourChip,
  formatColourValue,
  mergeAnalyses,
  normalizeCssColour,
  pricingColourCount,
  type ColourAnalysis,
} from "@/lib/design/colourCount";
import { saveDraftAction, type DesignSubmitInput } from "./actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { HelpPrompt } from "@/components/support/HelpPrompt";
import { MethodGuideModal, type MethodKey } from "@/components/storefront/MethodGuideModal";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/cart/CartContext";
import { formatCAD, roundCents } from "@/lib/money";
import { calcPrice } from "@/lib/pricing/platform";
import {
  curveForProduct,
  decorationForMethodSlug,
  nextCurveBreak,
  priceFromCurve,
} from "@/lib/pricing/quote";
import { fmtDate, inHandsWindow } from "@/lib/turnaround";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { swatchStyle } from "@/lib/swatch";
import { DESIGNER_FONTS, type DesignerFont } from "@/lib/fonts";
import {
  MAX_UPLOAD_BYTES,
  classifyFile,
  formatSize,
  readImageDataUrl,
  renderPdfFirstPage,
} from "@/lib/design/uploadArt";
import type { ProductColourJson, PrintAreaPositionJson } from "@/lib/db/rows";

type View = "front" | "back" | "sleeve";
type Tool = "colour" | "upload" | "text" | "clipart";

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
  slug: string;
  setup_fee: number;
  per_unit_cost: number;
  per_color_cost: number;
}

/** A saved design loaded for editing, rehydrates the canvas + review state. */
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
    // Garment retail unit (post-markup, already public). Replaces the confidential
    // wholesale_cost + markup, which must not reach the client. Feeds the cost-plus
    // fallback below as calcPrice's `base_price` so its output is identical.
    garmentRetail: number;
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

// Floating canvas toolbars, frosted glass, no drop shadow, so the chrome sits
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
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#ff5d8f"/></svg>`,
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

  // Editable views, front/back only. Sleeve is intentionally excluded: we have
  // no true sleeve mockup, so instead of an editable canvas (which would show a
  // misleading front image) we route sleeve requests to a "message us" handoff.
  const views = useMemo(() => {
    const set = new Set<View>(props.printAreas.map((p) => normView(p.view)));
    return (["front", "back"] as View[]).filter((v) => set.has(v));
  }, [props.printAreas]);
  // Whether this product is configured for sleeve printing (drives the handoff).
  const hasSleeve = useMemo(
    () => props.printAreas.some((p) => normView(p.view) === "sleeve"),
    [props.printAreas]
  );

  const edit = props.initialDesign ?? null;
  const [colourName, setColourName] = useState(
    edit?.colourName ?? props.initialColourName ?? props.colours[0]?.name ?? "",
  );
  // The canvas that tool actions (upload/text/clip-art/undo) target. The user
  // switches it by clicking a canvas or the "Adding to" pills. Null = nothing
  // active (only possible in side-by-side "both" mode, after a click on the
  // neutral editor background clears the selection).
  const [activeView, setActiveView] = useState<View | null>(views[0] ?? "front");
  // Colour is the default landing tab, the first thing a customer sees.
  const [tool, setTool] = useState<Tool>("colour");
  // Left panel collapse, shrinks the column to just the icon rail.
  const [leftOpen, setLeftOpen] = useState(true);
  // Feedback under the upload dropzone: a rejected file (error) or a heads-up
  // like "showing page 1 of a multi-page PDF" (info). Cleared on each new pick.
  const [uploadMsg, setUploadMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  // True while a picked file is being read/rasterized (PDFs take a beat).
  const [uploadBusy, setUploadBusy] = useState(false);
  // The customer price curve (products.pricing_rules.quote), the same table
  // the product page quotes. When present it is THE pricing engine here too.
  const curve = useMemo(
    () => curveForProduct({ pricing_rules: props.pricing.pricing_rules as never }),
    [props.pricing.pricing_rules]
  );
  // Methods the customer can pick. When the product has a curve (the normal
  // case), only offer methods the curve can price, otherwise DTG/vinyl would
  // fall through to the uncalibrated cost-plus fallback and underprice the job.
  const priceableMethods = useMemo(
    () =>
      curve
        ? props.methods.filter((m) => {
            const d = decorationForMethodSlug(m.slug);
            return d !== null && (curve.breaks[d] ?? []).length > 0;
          })
        : props.methods,
    [curve, props.methods]
  );
  const [methodId, setMethodId] = useState(
    (edit?.methodId && priceableMethods.some((m) => m.id === edit.methodId) ? edit.methodId : null) ??
      priceableMethods[0]?.id ??
      null,
  );
  // Per-size quantity breakdown, collected on the review screen. Total quantity
  // is derived from the sum and drives pricing.
  const [sizeQty, setSizeQty] = useState<Record<string, number>>(edit?.primarySizeQty ?? {});
  // Additional garment colourways for the same artwork, each with its own size
  // breakdown. The primary (canvas) colour + sizeQty is the first colourway;
  // these are the "Add another colour" rows on the review screen.
  const [extraColorways, setExtraColorways] = useState<
    { id: string; colourName: string; sizeQty: Record<string, number> }[]
  >(() => (edit?.extraColorways ?? []).map((c, i) => ({ id: `cw-${i}`, ...c })));
  // Physical print size (W″ × H″) of each decorated side, derived from where
  // the customer placed + scaled the art inside the inch-true print box.
  const [measurements, setMeasurements] = useState<Partial<Record<View, ArtMetrics | null>>>({});
  // Per-side colour analysis of the artwork: exact for vectors/text, a
  // quantized estimate (or "full colour") for rasters. Null while an image's
  // analysis is still resolving.
  const [viewColours, setViewColours] = useState<Partial<Record<View, ColourAnalysis | null>>>({});
  // Analysis is cached per image source, so undo/redo/colour swaps (same data
  // URLs) never re-run it. `pending` guards duplicate in-flight analyses.
  const analysisCache = useRef(new Map<string, ColourAnalysis>());
  const pendingAnalyses = useRef(new Set<string>());
  // Rush delivery is disabled for now, the toggle was removed from the review
  // screen. Kept as a const so the pricing/snapshot plumbing stays intact.
  const rush = false;
  const [viewsWithArt, setViewsWithArt] = useState<Set<View>>(new Set());
  // Views where some artwork spills past the dashed print box. Purely a friendly
  // heads-up, never blocks ordering (a human rechecks every design at proofing).
  const [outOfBounds, setOutOfBounds] = useState<Set<View>>(new Set());
  // Which canvas currently has a selected object (drives the selection rail).
  // isText gates the text-only colour control.
  const [selection, setSelection] = useState<{ view: View; isText: boolean } | null>(null);
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
  // Mockups of the design (one per decorated side), shown on the left of the
  // review screen. The customer flips between them with the front/back toggle.
  const [previews, setPreviews] = useState<{ view: View; url: string }[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [textColor, setTextColor] = useState("#1b1458");
  // Text size + alignment: applied to the selected text object and used as the
  // default for newly added text. Alignment matters mostly for multi-line text.
  const [fontSize, setFontSize] = useState(40);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  // Currently-selected text font (identified by its CSS family string). New text
  // boxes use it; picking a font also restyles the selected text object.
  const [textFontCss, setTextFontCss] = useState(DESIGNER_FONTS[0].css);
  const textFont = DESIGNER_FONTS.find((f) => f.css === textFontCss) ?? DESIGNER_FONTS[0];
  // The font picker is a collapsed dropdown (there are many faces now) that
  // expands to a previewed list instead of a big always-open grid.
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  // "Save your design" modal, gates the checkout funnel, captures a name + lead
  // email before we send the customer into checkout.
  const [showSave, setShowSave] = useState(false);
  // "?" help dialog on the review spec table (measurement / colour count).
  const [helpTopic, setHelpTopic] = useState<null | "measurement" | "colours">(null);
  // Print-vs-embroidery guide modal. Null = closed; the value is the open tab.
  const [methodGuideTab, setMethodGuideTab] = useState<MethodKey | null>(null);
  const [designName, setDesignName] = useState(edit?.name || props.productName);
  const [leadEmail, setLeadEmail] = useState(edit?.leadEmail || props.accountEmail || "");
  const [saveError, setSaveError] = useState<string | null>(null);

  const artworkFiles = useRef<{ id: string; file: File }[]>([]);

  const colour = props.colours.find((c) => c.name === colourName);
  const method = priceableMethods.find((m) => m.id === methodId) ?? null;
  const printAreaForView = (v: View) => props.printAreas.find((p) => normView(p.view) === v);
  const specForView = (v: View): PrintAreaSpec | null => {
    const pa = printAreaForView(v);
    return pa
      ? { box: pa.position, name: pa.name, maxWidthIn: pa.maxWidthIn, maxHeightIn: pa.maxHeightIn }
      : null;
  };
  // Which side to SHOW when nothing is active: keeps single-view mode from ever
  // blanking. The visible "active" ring still tracks the raw (nullable) activeView.
  const displayView: View = activeView ?? views[0] ?? "front";

  const sizeRange =
    props.sizes.length > 0 ? `${props.sizes[0].name} to ${props.sizes[props.sizes.length - 1].name}` : null;

  const productInput = useMemo(
    () => ({
      // garmentRetailUnit() already resolved retail server-side; feed it as the
      // base_price so calcPrice returns it verbatim (base_price wins over
      // wholesale × markup). No confidential cost is present client-side.
      wholesale_cost: null,
      base_price: props.pricing.garmentRetail,
      markup_type: "flat",
      markup_value: 0,
      pricing_rules: props.pricing.pricing_rules as never,
    }),
    [props.pricing]
  );
  const locationCount = Math.max(1, viewsWithArt.size);

  // Pricing colour count, derived from the artwork (was a hardcoded 1). Exact
  // vector counts are used as-is; raster estimates and "full colour" are
  // provisional, the artist confirms the count (and price) at proofing, and
  // nothing is charged before the invoice. When sides differ we price the
  // highest count. Only matters for methods with a per-colour cost.
  const inkColours = useMemo(() => {
    const counts = views
      .filter((v) => viewsWithArt.has(v))
      .map((v) => viewColours[v])
      .filter((a): a is ColourAnalysis => !!a)
      .map((a) => pricingColourCount(a));
    return counts.length ? Math.max(...counts) : 1;
  }, [views, viewsWithArt, viewColours]);

  // Colourways share one job price: the quantity break applies to the COMBINED
  // quantity (same artwork and screens across garment colours), matching how
  // the product page and the industry price a run.
  const colourwayList = useMemo(
    () => [
      { colourName, sizeQty },
      ...extraColorways.map((e) => ({ colourName: e.colourName, sizeQty: e.sizeQty })),
    ],
    [colourName, sizeQty, extraColorways]
  );
  const colourwayQty = useMemo(
    () =>
      colourwayList.map((cw) =>
        Object.values(cw.sizeQty).reduce((s, n) => s + (n > 0 ? n : 0), 0)
      ),
    [colourwayList]
  );
  const quantity = colourwayQty.reduce((s, n) => s + n, 0);

  // Job pricing, the customer curve whenever the product has one and the
  // method maps onto it. Curve prices are all-inclusive, so setup is $0.
  // Products without a curve fall back to the platform cost-plus engine.
  const curveDecoration = decorationForMethodSlug(method?.slug);
  const jobPrice = useMemo(() => {
    const qty = Math.max(quantity, 1);
    if (curve && curveDecoration) {
      const r = priceFromCurve(curve, {
        qty,
        colours: inkColours,
        locations: locationCount,
        decoration: curveDecoration,
      });
      if (r.available) {
        return {
          engine: "curve" as const,
          unitPrice: roundCents(r.perUnit),
          setupTotal: 0,
          anchorPerUnit: roundCents(r.anchorPerUnit),
          discountPct: r.discountPct,
        };
      }
    }
    const p = calcPrice({ product: productInput, method, quantity: qty, colourCount: inkColours, locationCount });
    return {
      engine: "platform" as const,
      unitPrice: p.unitPrice,
      setupTotal: p.setupTotal,
      anchorPerUnit: roundCents(p.garmentRetail + p.decorationPerUnit),
      discountPct: p.bulkDiscountPct,
    };
  }, [quantity, curve, curveDecoration, inkColours, locationCount, productInput, method]);

  const pricedColorways = useMemo(
    () =>
      colourwayList.map((cw, i) => ({
        colourName: cw.colourName,
        hex: props.colours.find((c) => c.name === cw.colourName)?.hex ?? null,
        sizeQty: cw.sizeQty,
        quantity: colourwayQty[i],
        unitPrice: jobPrice.unitPrice,
        lineTotal: roundCents(jobPrice.unitPrice * colourwayQty[i]),
      })),
    [colourwayList, colourwayQty, jobPrice.unitPrice, props.colours]
  );

  const grandSubtotal = roundCents(pricedColorways.reduce((s, c) => s + c.lineTotal, 0));
  const breakdown = {
    unitPrice: jobPrice.unitPrice,
    subtotal: grandSubtotal,
    setupTotal: jobPrice.setupTotal,
    total: roundCents(grandSubtotal + jobPrice.setupTotal),
  };
  // Pre-discount unit price + savings for the headline estimate box (matches
  // the instant-estimate box on the product page, incl. its qty-12 anchor).
  const priceMeta = { anchorPerUnit: jobPrice.anchorPerUnit, discountPct: jobPrice.discountPct };

  // Next quantity break within reach, powers the "add N more to save X%"
  // nudge. Reads the curve's own tiers; falls back to platform bulkTiers.
  const nextTier = useMemo(() => {
    if (curve && curveDecoration && jobPrice.engine === "curve") {
      const next = nextCurveBreak(curve, {
        qty: quantity,
        colours: inkColours,
        locations: locationCount,
        decoration: curveDecoration,
      });
      return next ? { add: next.add, pct: next.savePct } : null;
    }
    const rules = (props.pricing.pricing_rules ?? {}) as { bulkTiers?: { minQty: number; discountPct: number }[] };
    const tiers = (rules.bulkTiers ?? []).slice().sort((a, b) => a.minQty - b.minQty);
    const next = tiers.find((t) => quantity < t.minQty && t.discountPct > priceMeta.discountPct);
    return next ? { add: next.minQty - quantity, pct: next.discountPct } : null;
  }, [curve, curveDecoration, jobPrice.engine, quantity, inkColours, locationCount, props.pricing.pricing_rules, priceMeta.discountPct]);

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
  // Art on each canvas is preserved, only the garment backdrop swaps.
  useEffect(() => {
    setLoadedViews(new Set());
    views.forEach((v) => {
      const c = canvasRefs.current[v];
      if (!c) return;
      c.setGarment(imageForView(colour, v));
      c.setPrintArea(specForView(v));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colourName]);

  // Warm every designer font up front so text renders in the right face on the
  // first paint (Fabric draws with whatever's loaded at paint time). Re-render
  // the canvases once they're ready in case a saved design used a custom font.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts?.load) return;
    let cancelled = false;
    Promise.all(
      DESIGNER_FONTS.map((f) =>
        document.fonts.load(`${f.weight} 40px ${JSON.stringify(f.family)}`).catch(() => {})
      )
    ).then(() => {
      if (cancelled) return;
      Object.values(canvasRefs.current).forEach((c) => c?.renderAll());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep each Fabric canvas's cached offset in sync with the CSS zoom transform.
  // Also re-measure after a canvas is un-hidden (single<->both / side switch),
  // since a display:none canvas reports a stale/zero offset.
  useEffect(() => {
    requestAnimationFrame(() => views.forEach((v) => canvasRefs.current[v]?.recalcOffset()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, viewMode, activeView]);

  // Undo/redo state reflects whichever canvas is currently active.
  useEffect(() => {
    setCanUndo(activeView ? (histories.current[activeView]?.length ?? 0) > 0 : false);
    setCanRedo(activeView ? (futures.current[activeView]?.length ?? 0) > 0 : false);
  }, [activeView]);

  function refreshUndo(v: View) {
    setCanUndo((histories.current[v]?.length ?? 0) > 0);
    setCanRedo((futures.current[v]?.length ?? 0) > 0);
  }

  // Delete / Backspace removes the selected object, unless a text box is being
  // edited (those keys edit the text) or focus is in a form field.
  useEffect(() => {
    if (!selection) return;
    const v = selection.view;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (canvasRefs.current[v]?.isEditingText()) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      deleteActiveOn(v);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  // Keyboard undo / redo on the active canvas: Cmd/Ctrl+Z undo,
  // Cmd/Ctrl+Shift+Z or Ctrl+Y redo. Ignored while editing a text box or typing
  // in a form field so the shortcut doesn't fight native text undo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== "design") return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
      if (activeView && canvasRefs.current[activeView]?.isEditingText()) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      if (isRedo) void redo();
      else void undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, phase]);

  /** Click on the neutral editor background: drop every canvas's object
   *  selection, and (in side-by-side mode) clear the active-canvas highlight so
   *  nothing looks selected. Single-view / single mode keep a target so the
   *  tools always have somewhere to place art. */
  function clearActive() {
    views.forEach((v) => canvasRefs.current[v]?.discardSelection());
    setSelection(null);
    if (views.length > 1 && viewMode === "both") setActiveView(null);
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

  /** Record a USER transform/text-edit for undo: `preScene` is the state before
   *  the change (captured by the canvas at gesture start). */
  function commitModify(v: View, preScene: object) {
    (histories.current[v] ??= []).push(preScene);
    if (histories.current[v].length > 30) histories.current[v].shift();
    futures.current[v] = [];
    refreshUndo(v);
    onCanvasChange(v);
  }

  async function undo() {
    const v = activeView;
    if (!v) return;
    const c = canvasRefs.current[v];
    const hist = histories.current[v];
    if (!c || !hist || hist.length === 0) return;
    (futures.current[v] ??= []).push(c.exportScene());
    const scene = hist.pop()!;
    setSelection(null);
    refreshUndo(v);
    // Wait for the scene to actually land before re-measuring, or the
    // art/bounds/colour recompute reads the half-loaded canvas.
    await c.loadScene(scene);
    onCanvasChange(v);
  }

  async function redo() {
    const v = activeView;
    if (!v) return;
    const c = canvasRefs.current[v];
    const fut = futures.current[v];
    if (!c || !fut || fut.length === 0) return;
    (histories.current[v] ??= []).push(c.exportScene());
    const scene = fut.pop()!;
    setSelection(null);
    refreshUndo(v);
    await c.loadScene(scene);
    onCanvasChange(v);
  }

  /** Analyze an image source once and cache it. PDFs get their original file's
   *  drawing commands read (exact) with a raster fallback on the preview PNG. */
  async function ensureAnalysis(src: string, pdfFile?: File) {
    if (analysisCache.current.has(src) || pendingAnalyses.current.has(src)) return;
    pendingAnalyses.current.add(src);
    try {
      let a: ColourAnalysis | null = null;
      if (pdfFile) a = await analyzePdfColours(pdfFile);
      if (!a) a = await analyzeImageSource(src);
      analysisCache.current.set(src, a);
    } catch {
      analysisCache.current.set(src, { kind: "full" });
    } finally {
      pendingAnalyses.current.delete(src);
      views.forEach(refreshColours);
    }
  }

  /** Recompute a side's merged colour analysis from what's on its canvas.
   *  Text fills are exact; images come from the cache (missing ones are kicked
   *  off async and this re-runs when they land). */
  function refreshColours(v: View) {
    const c = canvasRefs.current[v];
    if (!c) return;
    const descs = c.getArtDescriptors();
    if (descs.length === 0) {
      setViewColours((prev) => ({ ...prev, [v]: null }));
      return;
    }
    const analyses: ColourAnalysis[] = [];
    let pending = false;
    for (const d of descs) {
      if (d.type === "text") {
        const hex = normalizeCssColour(d.fill);
        analyses.push({ kind: "exact", colours: hex ? [hex] : [] });
      } else {
        const a = analysisCache.current.get(d.src);
        if (a) analyses.push(a);
        else {
          pending = true;
          void ensureAnalysis(d.src);
        }
      }
    }
    setViewColours((prev) => ({ ...prev, [v]: pending ? null : mergeAnalyses(analyses) }));
  }

  /** Recompute whether a given view has artwork (and whether any spills out),
   *  plus its live print measurement and colour count. */
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
    setMeasurements((prev) => ({ ...prev, [v]: has ? c.artMetrics() : null }));
    refreshColours(v);
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

  function onSelectionChange(v: View, has: boolean, isText?: boolean) {
    if (has) setActiveView(v);
    setSelection((prev) => (has ? { view: v, isText: !!isText } : prev?.view === v ? null : prev));
    // Sync the text controls to the newly selected text object so size / align /
    // colour reflect what the customer clicked (rather than the last-used values).
    if (has && isText) {
      const p = canvasRefs.current[v]?.getActiveTextProps();
      if (p) {
        setFontSize(Math.round(p.fontSize));
        setTextAlign(p.textAlign === "center" ? "center" : p.textAlign === "right" ? "right" : "left");
        setTextColor(p.fill);
      }
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadMsg(null);

    // 1. Size gate, reject before reading so a huge file never loads into memory.
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadMsg({
        tone: "error",
        text: `That file is ${formatSize(file.size)}, the max is ${formatSize(MAX_UPLOAD_BYTES)}. Try compressing it, or upload a vector (SVG/PDF).`,
      });
      return;
    }

    // 2. Type gate, only preview formats the browser can actually draw.
    const kind = classifyFile(file);
    if (kind.kind === "unsupported") {
      setUploadMsg({ tone: "error", text: kind.message });
      return;
    }

    const v = activeView;
    if (!v) {
      setUploadMsg({ tone: "error", text: "Click a shirt side (front or back) first, then upload your art." });
      return;
    }
    const id = crypto.randomUUID();
    setUploadBusy(true);
    try {
      // 3. Build the on-canvas preview: rasterize page 1 for PDFs, else read directly.
      let dataUrl: string;
      let info: string | null = null;
      if (kind.kind === "pdf") {
        const { dataUrl: png, numPages } = await renderPdfFirstPage(file);
        dataUrl = png;
        if (numPages > 1) info = `Multi-page PDF, showing page 1 of ${numPages}. We print from your full file.`;
      } else {
        dataUrl = await readImageDataUrl(file);
      }

      // Kick off the colour analysis keyed by the on-canvas source. For PDFs we
      // read the original file's drawing commands (exact when possible).
      void ensureAnalysis(dataUrl, kind.kind === "pdf" ? file : undefined);

      snapshot(v);
      await canvasRefs.current[v]?.addImageFromUrl(dataUrl);
      // Upload the ORIGINAL file as the print-ready source (full-quality PDF/vector).
      artworkFiles.current.push({ id, file });
      onCanvasChange(v);
      if (info) setUploadMsg({ tone: "info", text: info });
    } catch {
      setUploadMsg({
        tone: "error",
        text: "We couldn't read that file. Try a PNG, JPG, SVG, or PDF.",
      });
    } finally {
      setUploadBusy(false);
    }
  }

  function addText() {
    // Add an editable text object; the customer double-clicks on the canvas to edit it.
    const v = activeView;
    if (!v) return;
    snapshot(v);
    canvasRefs.current[v]?.addText("Your text", {
      fontFamily: textFont.css,
      fontWeight: textFont.weight,
      fill: textColor,
      fontSize,
      textAlign,
    });
    onCanvasChange(v);
  }

  async function addClipart(svg: string) {
    const v = activeView;
    if (!v) return;
    snapshot(v);
    await canvasRefs.current[v]?.addImageFromUrl(svgToDataUrl(svg));
    onCanvasChange(v);
  }

  function applyTextColor(hex: string) {
    setTextColor(hex);
    const v = selection?.view ?? activeView;
    if (!v) return;
    canvasRefs.current[v]?.setActiveColor(hex);
  }

  function applyTextFont(font: DesignerFont) {
    setTextFontCss(font.css);
    const v = selection?.view ?? activeView;
    if (!v) return;
    canvasRefs.current[v]?.setActiveFont(font.css, font.weight);
  }

  function applyFontSize(nRaw: number) {
    const n = Math.max(8, Math.min(200, Math.round(nRaw)));
    setFontSize(n);
    const v = selection?.view ?? activeView;
    if (!v) return;
    // Snapshot only when it actually mutates a selected text object (changing the
    // default for the next text box shouldn't create an undo step).
    if (selection?.isText && selection.view === v) snapshot(v);
    canvasRefs.current[v]?.setActiveFontSize(n);
  }

  function applyTextAlign(a: "left" | "center" | "right") {
    setTextAlign(a);
    const v = selection?.view ?? activeView;
    if (!v) return;
    if (selection?.isText && selection.view === v) snapshot(v);
    canvasRefs.current[v]?.setActiveTextAlign(a);
  }

  // Print-method picker, shown inside each tool panel (upload/text). Drives
  // decoration pricing and tells Julian how the job is made. Shared so both
  // panels stay in sync off the single `methodId` state.
  const methodPicker = priceableMethods.length > 0 && (
    <>
      <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-dream-muted">
        Print method
        <HelpDot
          label="Compare print and embroidery"
          onClick={() => setMethodGuideTab(isEmbroidery ? "embroidery" : "print")}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {priceableMethods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethodId(m.id)}
            aria-pressed={methodId === m.id}
            className={cn(
              "whitespace-nowrap rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors",
              methodId === m.id
                ? "border-dream-purple bg-dream-lavender-soft text-dream-ink"
                : "border-dream-line text-dream-muted hover:border-dream-line-strong"
            )}
          >
            {m.name}
          </button>
        ))}
      </div>
    </>
  );

  function layer(dir: "forward" | "back") {
    const v = selection?.view ?? activeView;
    if (!v) return;
    const c = canvasRefs.current[v];
    if (!c) return;
    snapshot(v);
    if (dir === "forward") c.bringForward();
    else c.sendBackward();
    onCanvasChange(v);
  }

  async function duplicate() {
    const v = selection?.view ?? activeView;
    if (!v) return;
    snapshot(v);
    await canvasRefs.current[v]?.duplicateActive();
    onCanvasChange(v);
  }

  function flip(axis: "h" | "v") {
    const v = selection?.view ?? activeView;
    if (!v) return;
    snapshot(v);
    canvasRefs.current[v]?.flipActive(axis);
    onCanvasChange(v);
  }

  function centerArt() {
    const v = selection?.view ?? activeView;
    if (!v) return;
    snapshot(v);
    canvasRefs.current[v]?.centerActiveInPrintArea();
    onCanvasChange(v);
  }

  function deleteActiveOn(v: View) {
    snapshot(v);
    canvasRefs.current[v]?.deleteActive();
    setSelection((prev) => (prev?.view === v ? null : prev));
    onCanvasChange(v);
  }

  function deleteActive() {
    const v = selection?.view ?? activeView;
    if (!v) return;
    deleteActiveOn(v);
  }

  async function stageUploads(items: { id: string; bucket: string; name: string; kind: string; blob: Blob }[]) {
    if (items.length === 0) return {} as Record<string, { bucket: string; path: string }>;
    const res = await fetch("/api/design/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: items.map((i) => ({ id: i.id, bucket: i.bucket, name: i.name, kind: i.kind, size: i.blob.size })) }),
    });
    if (!res.ok) {
      let msg = "Upload preparation failed";
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        /* non-JSON body, keep the generic message */
      }
      throw new Error(msg);
    }
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
    const comma = dataUrl.indexOf(",");
    const head = dataUrl.slice(0, comma);
    const body = dataUrl.slice(comma + 1);
    const mime = /^data:([^;,]+)/.exec(head)?.[1] ?? "image/png";
    // Not everything is base64: clip-art SVGs are utf8/percent-encoded
    // (`data:image/svg+xml;utf8,…`), atob() on those throws.
    if (!/;base64$/i.test(head)) {
      let text = body;
      try {
        text = decodeURIComponent(body);
      } catch {
        /* body wasn't percent-encoded, use it raw */
      }
      return new Blob([text], { type: mime });
    }
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /** Design -> review. Requires at least one decorated side before continuing. */
  function goToReview() {
    setError(null);
    // One mockup per decorated side (front, back, …), in view order, so the
    // review screen can flip between them.
    const shots = views
      .filter((v) => canvasRefs.current[v]?.hasObjects())
      .map((v) => ({ view: v, url: canvasRefs.current[v]?.exportMockup() ?? "" }))
      .filter((s) => s.url);
    if (shots.length === 0) {
      setError("Add some artwork or text to your design first.");
      return;
    }
    setPreviews(shots);
    setPreviewIdx(0);
    setPhase("review");
  }

  /**
   * Persist the current design as a draft, then route on. "cart" adds the saved
   * design to the lite cart (carrying the name + lead email from the save modal)
   * and sends the customer to /cart; "designs" parks the draft in My Designs. The
   * actual Order is NOT created here, it's placed from the cart at checkout.
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

      // Strip embedded data-URL art out of the scene payload. A big photo or a
      // rasterized PDF page is megabytes of base64, and the scene JSON travels
      // through a server action (1MB default cap, the "Body exceeded 1 MB
      // limit" bug). Each unique image is staged to Storage alongside the
      // mockups; the scene carries a `dh-staged:<path>` marker that the server
      // rewrites to a signed URL. Re-opened designs already hold https srcs,
      // which pass through untouched.
      const sceneSrcIds = new Map<string, string>(); // data URL -> staged item id
      const walkSceneImages = (objs: unknown[], fn: (rec: Record<string, unknown>) => void) => {
        for (const o of objs) {
          if (!o || typeof o !== "object") continue;
          const rec = o as Record<string, unknown>;
          if (typeof rec.src === "string") fn(rec);
          if (Array.isArray(rec.objects)) walkSceneImages(rec.objects, fn);
        }
      };
      const sceneObjects = (s: object) => ((s as { objects?: unknown[] }).objects ?? []);
      Object.values(allScenes).forEach((s) =>
        walkSceneImages(sceneObjects(s), (rec) => {
          const src = rec.src as string;
          if (!src.startsWith("data:") || sceneSrcIds.has(src)) return;
          // Tiny images (built-in clip art) stay inline, a storage round-trip
          // costs more than the bytes it saves.
          if (src.length < 32 * 1024) return;
          const id = `scene-img-${sceneSrcIds.size}`;
          sceneSrcIds.set(src, id);
          const blob = dataUrlToBlob(src);
          const ext = blob.type.includes("svg") ? "svg" : blob.type.includes("jpeg") ? "jpg" : "png";
          uploadItems.push({ id, bucket: "designs", name: `${id}.${ext}`, kind: "scene-image", blob });
        })
      );

      const staged = await stageUploads(uploadItems);

      // Swap each scene image's data URL for its staged-path marker.
      Object.values(allScenes).forEach((s) =>
        walkSceneImages(sceneObjects(s), (rec) => {
          const id = sceneSrcIds.get(rec.src as string);
          if (id && staged[id]) rec.src = `dh-staged:${staged[id].path}`;
        })
      );

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
        // Every colourway with quantity, one order line item each.
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
        sceneImages: [...sceneSrcIds.values()]
          .filter((id) => staged[id])
          .map((id) => ({ bucket: staged[id].bucket, path: staged[id].path })),
        mockups,
        artwork,
        priceSnapshot: {
          unitPrice: breakdown.unitPrice,
          subtotal: breakdown.subtotal,
          setupTotal: breakdown.setupTotal,
          total: breakdown.total,
          quantity,
          rush,
          inkColours,
          // Per-side print spec (real measurement + colour count), pre-fills
          // the admin decoration sheet so the artist starts from real values.
          decorationSpots: viewsArt.map((v) => {
            const pa = printAreaForView(v);
            const m = canvasRefs.current[v]?.artMetrics() ?? null;
            const a = viewColours[v] ?? null;
            return {
              view: v,
              location: pa?.name ?? VIEW_LABEL[v],
              type: method?.name ?? "",
              widthIn: m ? String(m.widthIn) : "",
              heightIn: m ? String(m.heightIn) : "",
              colours: a ? formatColourValue(a) : "",
            };
          }),
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
            mockupUrl: previews[0]?.url ?? null,
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
  // Sides that actually carry art, listed in the review spec table.
  const decoratedViews = views.filter((v) => viewsWithArt.has(v));
  // Any decorated side with art spilling past the print box (drives the review
  // heads-up). Informational only, never gates checkout.
  const anyOutOfBounds = decoratedViews.some((v) => outOfBounds.has(v));
  // Embroidery is decorated in thread; screen print / DTG in ink. Label the
  // colour count accordingly so the spec reads in the customer's terms.
  const isEmbroidery = (method?.name ?? "").toLowerCase().includes("embroid");
  const colourKindLabel = isEmbroidery ? "Thread colours" : "Ink colours";

  return (
    <div className="bg-dream-lavender-soft text-dream-ink">
      {/* App screen, exactly one viewport tall; each column scrolls on its own.
          The shirt-details section + footer below sit in normal page flow, so
          the whole page scrolls past the editor to reveal them. */}
      <div className="flex h-dvh flex-col overflow-hidden">
        {/* Slim designer header, the full store nav is intentionally dropped
            here so the canvas gets as much height as possible. Just the logo
            (home), cart, and account; "Back to product" lives on the left rail. */}
        <header className="flex shrink-0 items-center justify-between border-b border-dream-ink/15 bg-dream-lavender-soft px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Dreamhouse Printing home">
            <Image
              src="/dreamhouse-logo-nav.svg"
              alt="Dreamhouse Printing"
              width={457}
              height={298}
              priority
              className="h-9 w-auto sm:h-10"
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <CartNavButton />
            <Link
              href="/account"
              aria-label="Your account"
              title="Your account"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-dream-purple transition-transform hover:-translate-y-0.5 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
            >
              <AccountIcon className="h-[19px] w-[19px]" />
            </Link>
          </div>
        </header>

      {/* Full-bleed work area. Stays mounted (hidden) during the review phase so
          the canvases keep their artwork for mockup export. */}
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden", phase !== "design" && "hidden")}>
        {/* Left, clean white column: flat icon rail + product/tools panel.
            Collapses to just the rail (lg:w-20) when leftOpen is false. */}
        <aside
          className={cn(
            "flex shrink-0 bg-white transition-[width] duration-200 lg:overflow-hidden lg:border-r lg:border-dream-line",
            leftOpen ? "lg:w-[23rem]" : "lg:w-20"
          )}
        >
          {/* Vertical icon rail */}
          <div className="flex shrink-0 flex-row items-center gap-5 border-b border-dream-line px-3 py-3 lg:w-20 lg:flex-col lg:gap-9 lg:border-b-0 lg:border-r lg:py-7">
            {/* Single panel toggle, pinned to the top of the always-visible rail,
                same spot whether open or closed; the chevron just flips. */}
            <button
              onClick={() => setLeftOpen((o) => !o)}
              aria-label={leftOpen ? "Hide panel" : "Show panel"}
              aria-expanded={leftOpen}
              className="flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-dream-lavender-soft text-dream-purple">
                {/* Sidebar/panel glyph (not a back arrow) so it can't be confused
                    with the "Back" nav link directly below. The left column fills
                    in when the panel is open to signal its current state. */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
                  <path d="M9 4.5v15" />
                  {leftOpen && <rect x="3" y="4.5" width="6" height="15" rx="2.5" fill="currentColor" stroke="none" />}
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
            {/* Colour is its own tool and the default landing tab, it sits above
                Upload in the rail so picking a garment colour is the first step. */}
            <button
              onClick={() => {
                setTool("colour");
                setLeftOpen(true);
              }}
              aria-pressed={tool === "colour"}
              className={cn(
                "flex flex-col items-center justify-center gap-2 transition-transform hover:-translate-y-0.5",
                tool === "colour" && "h-14 w-14 rounded-lg bg-dream-ink pt-1.5 shadow-[0_4px_10px_-8px_rgba(27,20,88,0.4)]"
              )}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("h-5 w-5", tool === "colour" ? "text-white" : "text-dream-ink")}
                aria-hidden
              >
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h1.99c3.05 0 5.56-2.5 5.56-5.55C21.96 6.01 17.46 2 12 2z" />
                <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
                <circle cx="17.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
              </svg>
              <span className={cn("font-semibold", tool === "colour" ? "text-[10px] text-white" : "text-[11px] text-dream-ink")}>
                Colour
              </span>
            </button>
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
                    isActive && "h-14 w-14 rounded-lg bg-dream-ink pt-1.5 shadow-[0_4px_10px_-8px_rgba(27,20,88,0.4)]"
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
              href="/contact"
              target="_blank"
              rel="noopener noreferrer"
              title="Opens contact in a new tab so your design stays open"
              className="flex flex-col items-center gap-2 text-dream-purple transition-transform hover:-translate-y-0.5"
            >
              <SupportIcon />
              <span className="text-[11px] font-semibold text-dream-ink">Support</span>
            </Link>
          </div>

          {/* Panel, scrolls within the fixed-height aside; hidden when collapsed */}
          <div className={cn("no-scrollbar min-w-0 flex-1 overflow-y-auto p-5 lg:p-6", !leftOpen && "hidden")}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-dream-ink-soft">Garment</div>
            <h2 className="mt-1 font-display text-base font-extrabold leading-snug text-dream-ink">{props.productName}</h2>
            {sizeRange && <p className="mt-1 text-xs text-dream-muted">Sizes {sizeRange}</p>}

            {/* Colour picker, its own tab. Upload + Text follow below it (see
                the Design tools section) so a customer can keep scrolling. */}
            {tool === "colour" && (
              <>
            <div className="mt-4 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-dream-muted">Colour</span>
              <span className="truncate text-xs font-bold text-dream-purple">{colourName || "Pick one"}</span>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-x-2 gap-y-2.5 px-2.5 py-2.5">
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
                    {/* selected check, drops a contrasting tick on the chosen swatch */}
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
              </>
            )}

            <hr className="my-6 border-dream-line" />

            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-dream-ink-soft">Design tools</div>

            {activeView === null && (
              <p className="mt-2 rounded-lg bg-dream-sun/25 px-3 py-2 text-xs font-semibold text-dream-ink">
                Click a shirt side to start adding art.
              </p>
            )}

            {/* Tool panels. The colour tab also renders Upload + Text below the
                colour picker (scroll down) so a customer can keep going without
                switching tabs. Each panel is its own card. */}
            <div className="mt-3 space-y-4">
              {(tool === "upload" || tool === "colour") && (
                <div className="rounded-2xl bg-dream-cream/60 p-4">
                <>
                  <h3 className="font-display text-base font-bold text-dream-ink">Upload artwork</h3>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadBusy}
                    className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-dream-line-strong px-3 py-7 text-center transition-colors hover:border-dream-purple hover:bg-white/70 disabled:cursor-wait disabled:opacity-70 disabled:hover:border-dream-line-strong disabled:hover:bg-transparent"
                  >
                    <Image src="/designer/upload.svg" alt="" width={26} height={26} className="h-6 w-auto" />
                    <span className="text-sm font-bold text-dream-ink">
                      {uploadBusy ? "Reading your file…" : "Drop a file or click to browse"}
                    </span>
                    <span className="text-xs text-dream-faint">PNG, SVG, JPG, PDF up to 50 MB</span>
                  </button>
                  {uploadMsg && (
                    <p
                      className={cn(
                        "mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed",
                        uploadMsg.tone === "error"
                          ? "bg-dream-peach/40 text-dream-ink"
                          : "bg-dream-sun/25 text-dream-ink",
                      )}
                    >
                      {uploadMsg.text}
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-dream-muted">
                    Not print-ready? We&apos;ll touch up your art, free.
                  </p>
                  {(() => {
                    const pa = printAreaForView(displayView);
                    return pa?.maxWidthIn && pa?.maxHeightIn ? (
                      <p className="mt-2 text-xs leading-relaxed text-dream-muted">
                        {VIEW_LABEL[displayView]} prints up to {pa.maxWidthIn} × {pa.maxHeightIn} in.
                      </p>
                    ) : null;
                  })()}
                  {methodPicker}
                </>
                </div>
              )}

              {(tool === "text" || tool === "colour") && (
                <div className="rounded-2xl bg-dream-cream/60 p-4">
                <>
                  <h3 className="font-display text-base font-bold text-dream-ink">Add text</h3>
                  <button
                    onClick={addText}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dream-line bg-white px-3 py-3 text-sm font-semibold text-dream-ink transition-colors hover:border-dream-purple"
                  >
                    <Image src="/designer/tool-text.svg" alt="" width={16} height={16} className="h-4 w-auto" />
                    Add a text box
                  </button>
                  <div className="mt-3 text-xs font-medium text-dream-muted">Font</div>
                  {/* Collapsed dropdown, tap to expand a previewed list. Each row
                      renders its own label in its own face so the customer sees
                      what they're picking. Expands inline; the panel scrolls. */}
                  <button
                    type="button"
                    onClick={() => setFontMenuOpen((o) => !o)}
                    aria-expanded={fontMenuOpen}
                    className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-dream-line bg-white px-3 py-2.5 text-left transition-colors hover:border-dream-line-strong"
                  >
                    <span className="truncate text-lg leading-none text-dream-ink" style={{ fontFamily: textFont.css }}>
                      {textFont.label}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn("shrink-0 text-dream-muted transition-transform", fontMenuOpen && "rotate-180")}
                      aria-hidden
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {fontMenuOpen && (
                    <div className="no-scrollbar mt-1.5 max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-dream-line bg-white p-1">
                      {DESIGNER_FONTS.map((f) => {
                        const selected = textFontCss === f.css;
                        return (
                          <button
                            key={f.label}
                            type="button"
                            onClick={() => {
                              applyTextFont(f);
                              setFontMenuOpen(false);
                            }}
                            aria-pressed={selected}
                            title={f.label}
                            style={{ fontFamily: f.css }}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-lg leading-none transition-colors",
                              selected ? "bg-dream-lavender-soft text-dream-ink" : "text-dream-ink hover:bg-dream-cream"
                            )}
                          >
                            <span className="truncate">{f.label}</span>
                            {selected && (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-dream-purple" aria-hidden>
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                      {/* Bespoke-font escape hatch. Framed as "bring your art /
                          talk to us" on purpose: we don't want to invite endless
                          one-off font requests, so the ask is to upload the text
                          as artwork or start a conversation with a sample. Opens
                          contact in a new tab so the in-progress design stays put. */}
                      <div className="mt-1 border-t border-dream-line px-3 py-2.5">
                        <p className="text-xs leading-relaxed text-dream-muted">
                          Don&apos;t see the font you need? Upload your text as artwork, or{" "}
                          <a
                            href="/contact"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-dream-purple underline-offset-2 hover:underline"
                          >
                            talk to us
                          </a>{" "}
                          and send a sample. We&apos;ll set it up on your proof.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {/* Font size: stepper + editable number */}
                    <div>
                      <div className="text-xs font-medium text-dream-muted">Size</div>
                      <div className="mt-2 flex items-center overflow-hidden rounded-lg border border-dream-line bg-white">
                        <button
                          type="button"
                          onClick={() => applyFontSize(fontSize - 2)}
                          aria-label="Smaller text"
                          className="flex h-9 w-9 shrink-0 items-center justify-center text-dream-ink transition-colors hover:bg-dream-cream"
                        >
                          <MinusIcon />
                        </button>
                        <input
                          type="number"
                          min={8}
                          max={200}
                          value={fontSize}
                          onChange={(e) => applyFontSize(Number(e.target.value) || fontSize)}
                          aria-label="Font size"
                          className="h-9 w-full min-w-0 border-x border-dream-line text-center text-sm font-semibold text-dream-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => applyFontSize(fontSize + 2)}
                          aria-label="Bigger text"
                          className="flex h-9 w-9 shrink-0 items-center justify-center text-dream-ink transition-colors hover:bg-dream-cream"
                        >
                          <PlusIcon />
                        </button>
                      </div>
                    </div>
                    {/* Alignment: left / center / right */}
                    <div>
                      <div className="text-xs font-medium text-dream-muted">Align</div>
                      <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-dream-line bg-white p-1">
                        {(["left", "center", "right"] as const).map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => applyTextAlign(a)}
                            aria-pressed={textAlign === a}
                            aria-label={`Align ${a}`}
                            title={`Align ${a}`}
                            className={cn(
                              "flex h-7 items-center justify-center rounded-md transition-colors",
                              textAlign === a ? "bg-dream-lavender-soft text-dream-purple" : "text-dream-muted hover:bg-dream-cream"
                            )}
                          >
                            <AlignIcon align={a} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

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
                    {/* Custom colour, opens the native picker for anything else. */}
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

                  {/* On the colour tab the Upload card already shows the method
                      picker, so don't render a second one here. */}
                  {tool !== "colour" && methodPicker}
                </>
                </div>
              )}

              {tool === "clipart" && (
                <div className="rounded-2xl bg-dream-cream/60 p-4">
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
                </div>
              )}
            </div>

            {/* Sleeve (and other special placements) aren't in the online
                designer, hand those off to a real person instead of faking a
                mockup. */}
            <div className="mt-5 rounded-2xl border border-dream-line bg-dream-cream/50 p-4">
              <h3 className="font-display text-sm font-bold text-dream-ink">
                Want it on the sleeve{hasSleeve ? "" : " or somewhere else"}?
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-dream-muted">
                The designer covers front and back. For sleeves, tags, or anything custom, message us and we&apos;ll send you a proof.
              </p>
              <Link
                href="/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 font-display text-xs font-bold text-dream-purple transition-transform hover:-translate-y-0.5"
              >
                Message us
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/svg+xml,application/pdf"
              hidden
              onChange={onPickFile}
            />
          </div>
        </aside>

        {/* Center, grid-backed canvas stage (full bleed) */}
        <main className="relative flex min-h-[60vh] flex-1 flex-col overflow-hidden lg:min-h-0" style={GRID_BG}>
          {/* Floating top bar */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex items-center justify-between px-4">
            <span className={cn(GLASS, "pointer-events-auto px-3 py-1.5 font-display text-xs font-bold text-dream-ink")}>
              {views.length <= 1
                ? "Design preview"
                : viewMode === "both"
                  ? "Front & back"
                  : activeView
                    ? `Editing the ${VIEW_LABEL[activeView].toLowerCase()}`
                    : "Pick a side to edit"}
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

          {/* Canvases, every decorated side side by side, each editable. The
              active one is ringed; clicking a canvas makes it the tool target. */}
          <div
            onMouseDown={clearActive}
            className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-5 overflow-auto p-4 pt-16 pb-20"
          >
            {views.map((v) => {
              const isActive = viewMode === "both" && views.length > 1 && v === activeView;
              const loading = !loadedViews.has(v);
              // In single mode only the shown side is visible; the others stay
              // mounted (so their art is preserved + still exports) but hidden.
              // Falls back to displayView so nothing is active never blanks it.
              const hidden = viewMode === "single" && v !== displayView;
              return (
                <div
                  key={v}
                  ref={(el) => {
                    stageRefs.current[v] = el;
                  }}
                  onMouseDown={(e) => {
                    // Keep the outside-click handler on the neutral background from
                    // firing when a canvas itself is clicked.
                    e.stopPropagation();
                    setActiveView(v);
                  }}
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
                  <div
                    className={cn("relative w-fit rounded-2xl bg-white ring-1 ring-dream-ink/[0.05] p-2 transition-transform duration-150 sm:p-2.5", isActive && "ring-2 ring-dream-purple")}
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                  >
                    <div className="mx-auto w-fit">
                      <DesignCanvas
                        ref={(h) => {
                          canvasRefs.current[v] = h;
                        }}
                        onSelectionChange={(has, isText) => onSelectionChange(v, has, isText)}
                        onChange={() => onCanvasChange(v)}
                        onRequestDelete={() => deleteActiveOn(v)}
                        onModifyCommit={(pre) => commitModify(v, pre)}
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

                    {/* Out-of-bounds heads-up, subtle, non-blocking. Never
                        intercepts canvas clicks (pointer-events-none). */}
                    {!loading && outOfBounds.has(v) && (
                      <div className="pointer-events-none absolute right-2 top-2 z-10 max-w-[13rem]">
                        <div className="flex items-start gap-1.5 rounded-xl bg-dream-sun/95 px-2.5 py-1.5 text-left ring-1 ring-dream-ink/10 backdrop-blur-sm">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0 text-dream-ink" aria-hidden>
                            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                          </svg>
                          <p className="text-[11px] font-semibold leading-snug text-dream-ink">
                            Some art is outside the print lines. We&apos;ll double-check it.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating bottom bar, side switch (left) + selected-object actions */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-wrap items-center justify-start gap-2 px-4">
            {/* Side switch, pick which side to design; "See both" shows them together */}
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
                        on ? "bg-dream-purple text-white" : "text-dream-muted hover:text-dream-ink"
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
          </div>

          {/* Selection rail, object actions live here (right edge, vertically
              centered) so they're easy to find, unlike the old bottom bar. Shows
              only while something is selected. */}
          {selection && (
            <div className="pointer-events-none absolute inset-y-0 right-3 z-10 flex items-center">
              <div className={cn(GLASS, "pointer-events-auto flex w-48 flex-col p-1.5")}>
                <RailBtn label="Duplicate" onClick={duplicate}><DuplicateIcon /></RailBtn>
                <RailBtn label="Flip horizontal" onClick={() => flip("h")}><FlipHIcon /></RailBtn>
                <RailBtn label="Flip vertical" onClick={() => flip("v")}><FlipVIcon /></RailBtn>
                <RailBtn label="Center in box" onClick={centerArt}><CenterIcon /></RailBtn>
                <span aria-hidden className="my-1 h-px w-full bg-dream-line" />
                <RailBtn label="Bring forward" onClick={() => layer("forward")}><ForwardIcon /></RailBtn>
                <RailBtn label="Send backward" onClick={() => layer("back")}><BackwardIcon /></RailBtn>
                {selection.isText && (
                  <label
                    title="Text colour"
                    className="relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-dream-ink transition-colors hover:bg-dream-cream"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center">
                      <span className="h-4 w-4 rounded-full ring-1 ring-inset ring-dream-ink/20" style={{ backgroundColor: textColor }} />
                    </span>
                    <span className="whitespace-nowrap">Text colour</span>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => applyTextColor(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label="Text colour"
                    />
                  </label>
                )}
                <span aria-hidden className="my-1 h-px w-full bg-dream-line" />
                <RailBtn label="Delete" onClick={deleteActive} danger><TrashIcon /></RailBtn>
              </div>
            </div>
          )}
        </main>
        </div>

        {/* Design footer, pricing & quantity live on the review screen; this advances to it */}
        {phase === "design" && (
          <div className="shrink-0 border-t border-dream-line bg-white px-4 py-2">
            <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <p className={cn("hidden truncate text-sm sm:block", error ? "font-medium text-dream-danger" : "text-dream-muted")}>
                  {error ?? "Looking good! Set your quantity and see pricing next."}
                </p>
                <button
                  onClick={goToReview}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-dream-purple px-7 py-2.5 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                >
                  Continue
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review screen, scrollable content above a sticky checkout bar */}
        {phase === "review" && (
          <div className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Progress, full-width above the two columns so the customer knows
                where they are and that payment comes only after they approve. */}
            <div className="border-b border-dream-line bg-dream-cream/60">
              <ReviewStepper className="mx-auto max-w-6xl px-4 py-3.5 sm:px-6 lg:px-8" />
            </div>
            {/* Item (left) + details (right). The preview fills the left region
                and is top-aligned + sticky so it stays put while the form on the
                right grows/scrolls (typing a quantity no longer shifts it). */}
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 pb-20 sm:px-6 lg:flex-row lg:items-start lg:gap-12 lg:px-8 lg:pt-12 lg:pb-28">
              {/* Preview, centered in the left region, pinned in place. The
                  back button sits at its top-left corner. */}
              <div className="relative flex min-h-[260px] items-center justify-center self-stretch p-3 lg:sticky lg:top-12 lg:min-h-[60vh] lg:flex-1 lg:self-start lg:pr-16">
                <button
                  onClick={() => setPhase("design")}
                  className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 font-display text-sm font-bold text-dream-ink transition-colors hover:text-dream-purple lg:-left-2 lg:top-0"
                >
                  <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
                  Back to designing
                </button>
                {previews.length > 0 ? (
                  <div className="flex w-full flex-col items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={(previews[previewIdx] ?? previews[0]).url}
                      alt={`Your design, ${VIEW_LABEL[(previews[previewIdx] ?? previews[0]).view]}`}
                      className="max-h-[60vh] w-auto max-w-full object-contain"
                    />
                    {/* Front / back (…) toggle, only when more than one side is decorated. */}
                    {previews.length > 1 && (
                      <div className="inline-flex gap-1 rounded-full bg-dream-cream p-1 ring-1 ring-dream-line">
                        {previews.map((p, i) => (
                          <button
                            key={p.view}
                            type="button"
                            onClick={() => setPreviewIdx(i)}
                            aria-pressed={i === previewIdx}
                            className={cn(
                              "rounded-full px-4 py-1.5 font-display text-sm font-bold transition-colors",
                              i === previewIdx
                                ? "bg-dream-ink text-white shadow-sm"
                                : "text-dream-ink-soft hover:text-dream-ink",
                            )}
                          >
                            {VIEW_LABEL[p.view]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-dream-muted">Preview unavailable</span>
                )}
              </div>

              {/* Details, a fixed-width form column on the right. */}
              <div className="w-full lg:w-[34rem] lg:shrink-0">
                {/* Decoration spec, what's printed, where, and in how many colours.
                    "Colours" reads as thread (embroidery) or ink (print). */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-dream-purple">What we&apos;re printing</div>
                    <span className="text-xs font-semibold text-dream-muted">
                      {decoratedViews.length} {decoratedViews.length === 1 ? "location" : "locations"}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-dream-line">
                    <div className="grid grid-cols-[0.9fr_0.9fr_1.1fr_auto] items-center gap-x-3 bg-dream-cream px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-dream-muted">
                      <span>Location</span>
                      <span>Method</span>
                      <span className="flex items-center gap-1.5">
                        Measurement
                        <HelpDot label="About the print measurement" onClick={() => setHelpTopic("measurement")} />
                      </span>
                      <span className="flex items-center justify-end gap-1.5 text-right">
                        {colourKindLabel}
                        <HelpDot label="About the colour count" onClick={() => setHelpTopic("colours")} />
                      </span>
                    </div>
                    {decoratedViews.map((v) => {
                      const pIdx = previews.findIndex((p) => p.view === v);
                      const interactive = previews.length > 1 && pIdx >= 0;
                      const isActivePreview = interactive && pIdx === previewIdx;
                      return (
                      <div
                        key={v}
                        role={interactive ? "button" : undefined}
                        tabIndex={interactive ? 0 : undefined}
                        aria-pressed={interactive ? isActivePreview : undefined}
                        onClick={interactive ? () => setPreviewIdx(pIdx) : undefined}
                        onKeyDown={
                          interactive
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setPreviewIdx(pIdx);
                                }
                              }
                            : undefined
                        }
                        className={cn(
                          "border-t border-dream-line px-4 py-3.5 text-sm text-dream-ink first:border-t-0",
                          interactive &&
                            "cursor-pointer transition-colors hover:bg-dream-cream/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dream-purple/40",
                          isActivePreview && "bg-dream-lavender-mist",
                        )}
                      >
                        <div className="grid grid-cols-[0.9fr_0.9fr_1.1fr_auto] items-center gap-x-3">
                          <span className="flex items-center gap-1.5 font-semibold">
                            {VIEW_LABEL[v]}
                            {interactive && (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("shrink-0 transition-opacity", isActivePreview ? "text-dream-purple opacity-100" : "text-dream-faint opacity-0")} aria-hidden>
                                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </span>
                          <span className="text-dream-ink-soft">{method?.name ?? "Print"}</span>
                          <span className="whitespace-nowrap text-dream-ink-soft">
                            {measurements[v]
                              ? `${measurements[v]!.widthIn}″ W × ${measurements[v]!.heightIn}″ H`
                              : "-"}
                          </span>
                          <span className="justify-self-end whitespace-nowrap rounded-full bg-dream-lavender-soft px-2.5 py-0.5 text-xs font-bold text-dream-purple">
                            {viewColours[v] ? formatColourChip(viewColours[v]!, isEmbroidery ? "thread" : "ink") : "-"}
                          </span>
                        </div>
                        {outOfBounds.has(v) && (
                          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-dream-warn-soft px-2.5 py-1.5 text-xs font-medium leading-snug text-dream-warn">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0" aria-hidden>
                              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                            </svg>
                            Art extends past the print area. We&apos;ll double-check it with you.
                          </p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>

                <hr className="my-8 border-dream-line" />
                {/* Colours & sizes, one block per garment colourway. Same artwork,
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

                {/* Estimate, same grounded price box as the product page's
                    instant estimate: per-unit (with bulk savings) + est. total. */}
                <div className="mt-8 rounded-2xl border border-dream-lavender-soft bg-dream-lavender-mist px-5 py-4.5">
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
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-dream-purple-dark/70">Quantity</p>
                      <p className="font-display text-xl font-bold leading-none text-dream-ink">
                        {quantity || 0} unit{quantity === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  {nextTier && quantity > 0 && (
                    <div className="mt-3 flex items-center gap-2.5">
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-dream-sun px-2.5 py-1 font-display text-xs font-extrabold text-dream-ink">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.3-8.3a1 1 0 0 0 0-1.4L12 2Z" /><path d="M6.5 6.5h.01" /></svg>
                        Save {nextTier.pct}%
                      </span>
                      <span className="text-xs font-semibold text-dream-ink">Add {nextTier.add} more {nextTier.add === 1 ? "item" : "items"} to unlock</span>
                    </div>
                  )}
                  {/* Running subtotal + what's still to come, so the per-unit
                      figure above isn't mistaken for the out-the-door price.
                      Shipping is free; tax is added at checkout once we know
                      the province (this screen has no address yet). */}
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-dream-lavender-soft pt-2.5">
                    <span className="text-xs font-semibold text-dream-purple-dark/80">Estimated subtotal</span>
                    <span className="font-display text-base font-bold text-dream-purple-dark">{formatCAD(breakdown.subtotal)}</span>
                  </div>
                  <p className="mt-1.5 text-xs font-medium leading-relaxed text-dream-muted">
                    Free shipping. Tax is added at checkout, and final pricing is confirmed on your proof before you pay.
                  </p>
                </div>

                {/* Estimated delivery, one confident in-hands date (shared math
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

                {/* Reassurance, the risk-reducers a first-time custom buyer
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

                <HelpPrompt
                  variant="inline"
                  title="Not sure about sizes, colours, or your art?"
                  newTab
                  className="mt-6"
                />

              </div>
            </div>
            </div>

            {/* Sticky checkout bar, pinned to the bottom of the viewport so the
                CTA is always reachable while the form above scrolls. */}
            <div className="shrink-0 border-t border-dream-line bg-white px-4 py-3 sm:px-6">
              <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                {anyOutOfBounds && !error && (
                  <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-dream-warn sm:mr-auto">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    </svg>
                    Some art sits outside the print lines. We&apos;ll double-check it before printing.
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

      {/* "?" help on the review spec table, the same reassurance for both
          columns: an artist reviews everything before production/payment. */}
      <Dialog open={helpTopic !== null} onOpenChange={(o) => { if (!o) setHelpTopic(null); }}>
        <DialogContent className="max-w-sm" backdropClassName="bg-dream-overlay/50 backdrop-blur-sm">
          <DialogHeader className="px-6 pt-6 pb-1">
            <DialogTitle>{helpTopic === "colours" ? colourKindLabel : "Print measurement"}</DialogTitle>
            <DialogDescription className="pt-1 leading-relaxed">
              Not right? Each order is reviewed by an artist before we begin production or process
              payment. Please enter your desired print size in the notes section, and our staff will
              make the correct price adjustments for you to review.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end px-6 pb-6 pt-3">
            <button
              onClick={() => setHelpTopic(null)}
              className="rounded-full bg-dream-purple px-5 py-2 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print vs embroidery guide, opened by the "?" on the print-method picker. */}
      <MethodGuideModal
        open={methodGuideTab !== null}
        tab={methodGuideTab ?? "print"}
        onTab={setMethodGuideTab}
        onClose={() => setMethodGuideTab(null)}
      />

      {/* Save-your-design gate, names the design + captures a lead email, then
          adds it to the cart. */}
      <Dialog open={showSave} onOpenChange={(o) => { if (busy === null) setShowSave(o); }}>
        <DialogContent className="max-w-md" backdropClassName="bg-dream-overlay/50 backdrop-blur-sm">
          <DialogHeader className="px-6 pt-6 pb-1">
            <DialogTitle>Name your design</DialogTitle>
            <DialogDescription>
              Give it a name so you can spot it in your cart, and add your email. We’ll send you a link to pick this design back up, and that’s where your proof will land.
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
              {props.accountEmail && (
                <p className="mt-1.5 text-xs text-dream-muted">
                  This design saves to your account ({props.accountEmail}). The email above is just where we send updates and your proof.
                </p>
              )}
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
              s.state === "current" && "bg-dream-sun text-dream-ink",
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
            <ColourSelect value={name} hex={hex} colours={colours ?? []} onChange={onColour} />
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
      {/* Sizes laid out in a single row, label on top, number box below, so
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

/** Custom garment-colour picker: a swatch+name trigger that opens a branded
 *  dropdown showing every colour as a swatch beside its name (with a search box
 *  for long lists). Replaces the native <select> so the options aren't the bare
 *  OS list. Closes on outside-click / Escape / selection. */
function ColourSelect({
  value,
  hex,
  colours,
  onChange,
}: {
  value: string;
  hex: string | null;
  colours: ProductColourJson[];
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  // Direction + height are measured against the viewport on open so the panel
  // never spills past the bottom fold: it flips up when there's more room above,
  // and caps its height to whatever space is actually available.
  const [placement, setPlacement] = useState<{ up: boolean; maxH: number }>({ up: false, maxH: 320 });

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const below = window.innerHeight - r.bottom - 16;
      const above = r.top - 16;
      const up = below < 280 && above > below;
      setPlacement({ up, maxH: Math.max(180, Math.min(360, up ? above : below)) });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? colours.filter((c) => c.name.toLowerCase().includes(q)) : colours;

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Garment colour"
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-white py-1.5 pl-2.5 pr-8 text-left transition-colors",
          open ? "border-dream-purple ring-2 ring-dream-purple/25" : "border-dream-line hover:border-dream-line-strong",
        )}
      >
        <span className="h-5 w-5 shrink-0 rounded-full border border-dream-line" style={swatchStyle({ name: value, hex })} />
        <span className="truncate text-sm font-semibold text-dream-ink">{value}</span>
        <svg
          className={cn("pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-dream-muted transition-transform", open && "rotate-180")}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          style={{ maxHeight: placement.maxH }}
          className={cn(
            "absolute left-0 z-30 flex w-64 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-dream-line bg-white shadow-[0_12px_32px_-8px_rgba(27,20,88,0.25)]",
            placement.up ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {colours.length > 8 && (
            <div className="shrink-0 border-b border-dream-line p-2">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search colours…"
                className="w-full rounded-lg border border-dream-line bg-dream-cream/50 px-3 py-2 text-sm text-dream-ink outline-none placeholder:text-dream-faint focus:border-dream-purple focus:bg-white"
              />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-3 text-center text-sm text-dream-muted">No colours match.</p>
            ) : (
              filtered.map((c) => {
                const isSel = c.name === value;
                return (
                  <button
                    key={c.name}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => {
                      onChange(c.name);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                      isSel ? "bg-dream-lavender-soft" : "hover:bg-dream-lavender-mist",
                    )}
                  >
                    <span className="h-5 w-5 shrink-0 rounded-full border border-dream-line" style={swatchStyle(c)} />
                    <span className={cn("flex-1 truncate text-sm", isSel ? "font-bold text-dream-ink" : "font-medium text-dream-ink-soft")}>
                      {c.name}
                    </span>
                    {isSel && (
                      <svg className="shrink-0 text-dream-purple" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- bits --------------------------------- */

/** Small "?" affordance on a spec-table column header. Stops propagation so it
 *  never triggers the row/preview click behind it. */
function HelpDot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-dream-muted/60 text-[9.5px] font-bold normal-case leading-none text-dream-muted transition-colors hover:border-dream-purple hover:text-dream-purple"
    >
      ?
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

function RailBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors",
        danger ? "text-dream-danger hover:bg-dream-danger-soft" : "text-dream-ink hover:bg-dream-cream"
      )}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center">{children}</span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function DuplicateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function FlipHIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" strokeDasharray="3 3" />
      <path d="M8 8 4 12l4 4V8Z" />
      <path d="m16 8 4 4-4 4V8Z" />
    </svg>
  );
}
function FlipVIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18" strokeDasharray="3 3" />
      <path d="M8 8 12 4l4 4H8Z" />
      <path d="M8 16l4 4 4-4H8Z" />
    </svg>
  );
}
function CenterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
function ForwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 8 5-8 5-8-5 8-5Z" />
      <path d="m20 14-8 5-8-5" />
    </svg>
  );
}
function BackwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 11 8 5-8 5-8-5 8-5Z" />
      <path d="M4 8l8-5 8 5" strokeDasharray="3 3" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
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
function AlignIcon({ align }: { align: "left" | "center" | "right" }) {
  // Four horizontal rules; the short ones sit left / centered / right to mirror
  // the chosen text alignment.
  const short = align === "left" ? "M4 12h9" : align === "right" ? "M11 12h9" : "M7 12h10";
  const shorter = align === "left" ? "M4 18h6" : align === "right" ? "M14 18h6" : "M9 18h6";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16" />
      <path d={short} />
      <path d="M4 15h16" />
      <path d={shorter} />
    </svg>
  );
}
