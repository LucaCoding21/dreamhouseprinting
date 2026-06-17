"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { DesignCanvas, type DesignCanvasHandle, type PrintBox } from "./DesignCanvas";
import { submitDesignAction, saveDraftAction, type DesignSubmitInput } from "./actions";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { calcPrice } from "@/lib/pricing/platform";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ProductColourJson, PrintAreaPositionJson } from "@/lib/db/rows";

type View = "front" | "back" | "sleeve";

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

export function DesignerClient(props: Props) {
  const router = useRouter();
  const canvasRef = useRef<DesignCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevViewRef = useRef<View | null>(null);
  const history = useRef<object[]>([]);

  // Distinct views that have a print area, ordered.
  const views = useMemo(() => {
    const set = new Set<View>(props.printAreas.map((p) => normView(p.view)));
    return (["front", "back", "sleeve"] as View[]).filter((v) => set.has(v));
  }, [props.printAreas]);

  const [colourName, setColourName] = useState(props.colours[0]?.name ?? "");
  const [view, setView] = useState<View>(views[0] ?? "front");
  const [methodId, setMethodId] = useState(props.methods[0]?.id ?? null);
  const [sizeQty, setSizeQty] = useState<Record<string, number>>({});
  const [inkColours, setInkColours] = useState(1);
  const [scenes, setScenes] = useState<Record<string, object>>({});
  const [viewsWithArt, setViewsWithArt] = useState<Set<View>>(new Set());
  const [hasSelection, setHasSelection] = useState(false);
  const [hasArt, setHasArt] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [garmentLoading, setGarmentLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState<null | "save" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  const [textColor, setTextColor] = useState("#1b1458");

  const artworkFiles = useRef<{ id: string; file: File }[]>([]);

  const colour = props.colours.find((c) => c.name === colourName);
  const method = props.methods.find((m) => m.id === methodId) ?? null;
  const printAreaForView = (v: View) => props.printAreas.find((p) => normView(p.view) === v);
  const boxForView = (v: View): PrintBox | null => {
    const pa = printAreaForView(v);
    return pa ? pa.position : null;
  };

  const quantity = Object.values(sizeQty).reduce((a, b) => a + (b || 0), 0);
  const breakdown = useMemo(
    () =>
      calcPrice({
        product: {
          wholesale_cost: props.pricing.wholesale_cost,
          base_price: props.pricing.base_price,
          markup_type: props.pricing.markup_type,
          markup_value: props.pricing.markup_value,
          pricing_rules: props.pricing.pricing_rules as never,
        },
        method,
        quantity: Math.max(quantity, 1),
        colourCount: inkColours,
        locationCount: Math.max(1, viewsWithArt.size),
      }),
    [props.pricing, method, quantity, inkColours, viewsWithArt]
  );

  // Apply garment + print area when colour or view changes; load that view's scene on a view switch.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    setGarmentLoading(true);
    c.setGarment(imageForView(colour, view));
    c.setPrintArea(boxForView(view));
    if (prevViewRef.current !== view) {
      const saved = scenes[view];
      if (saved) c.loadScene(saved);
      else c.clearArt();
      prevViewRef.current = view;
      history.current = [];
      setCanUndo(false);
    }
    setHasArt(!!c.hasObjects());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colourName, view]);

  // Keep Fabric's cached offset in sync with the CSS zoom transform.
  useEffect(() => {
    canvasRef.current?.recalcOffset();
  }, [zoom]);

  function snapshot() {
    const c = canvasRef.current;
    if (!c) return;
    history.current.push(c.exportScene());
    if (history.current.length > 30) history.current.shift();
    setCanUndo(true);
  }

  function undo() {
    const c = canvasRef.current;
    if (!c || history.current.length === 0) return;
    const prev = history.current.pop()!;
    c.loadScene(prev);
    setCanUndo(history.current.length > 0);
    setHasSelection(false);
    onCanvasChange();
  }

  function changeView(nv: View) {
    if (nv === view) return;
    const c = canvasRef.current;
    if (c) setScenes((s) => ({ ...s, [view]: c.exportScene() }));
    setView(nv);
  }

  function onCanvasChange() {
    const c = canvasRef.current;
    if (!c) return;
    const has = c.hasObjects();
    setHasArt(has);
    setViewsWithArt((prev) => {
      const next = new Set(prev);
      if (has) next.add(view);
      else next.delete(view);
      return next;
    });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    snapshot();
    const id = crypto.randomUUID();
    const reader = new FileReader();
    reader.onload = async () => {
      await canvasRef.current?.addImageFromUrl(reader.result as string);
      artworkFiles.current.push({ id, file });
      onCanvasChange();
    };
    reader.readAsDataURL(file);
  }

  function addText() {
    // Add an editable text object; the customer double-clicks on the canvas to edit it.
    snapshot();
    canvasRef.current?.addText("Your text");
    onCanvasChange();
  }

  function applyTextColor(hex: string) {
    setTextColor(hex);
    canvasRef.current?.setActiveColor(hex);
  }

  function deleteActive() {
    snapshot();
    canvasRef.current?.deleteActive();
    onCanvasChange();
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

  async function finalize(asQuote: boolean) {
    setError(null);
    if (!props.isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/design/${props.productId}`)}`);
      return;
    }
    if (quantity < 1 && !asQuote) {
      setError("Add at least one size & quantity.");
      return;
    }
    // Save current view scene.
    const c = canvasRef.current;
    if (!c) return;
    const currentScene = c.exportScene();
    const allScenes = { ...scenes, [view]: currentScene };
    if (!c.hasObjects() && viewsWithArt.size === 0) {
      setError("Add some artwork or text to your design first.");
      return;
    }

    setBusy(asQuote ? "save" : "submit");
    try {
      // Mockup of the current view (the visible proof).
      const mockupData = c.exportMockup();
      const uploadItems: { id: string; bucket: string; name: string; kind: string; blob: Blob }[] = [];
      if (mockupData) {
        uploadItems.push({ id: "mockup-" + view, bucket: "designs", name: `mockup-${view}.png`, kind: "mockup", blob: dataUrlToBlob(mockupData) });
      }
      for (const af of artworkFiles.current) {
        uploadItems.push({ id: af.id, bucket: "artwork", name: af.file.name, kind: "artwork", blob: af.file });
      }
      const staged = await stageUploads(uploadItems);

      const mockups = mockupData ? [{ view, bucket: "designs", path: staged["mockup-" + view].path }] : [];
      const artwork = artworkFiles.current
        .filter((af) => staged[af.id])
        .map((af) => ({ name: af.file.name, bucket: "artwork", path: staged[af.id].path }));

      const input: DesignSubmitInput = {
        productId: props.productId,
        colourName,
        colourHex: colour?.hex,
        sizeQuantities: sizeQty,
        decorationMethodId: methodId,
        printAreaIds: [...viewsWithArt].map((v) => printAreaForView(v)?.id).filter(Boolean) as string[],
        scenes: allScenes,
        mockups,
        artwork,
        priceSnapshot: {
          unitPrice: breakdown.unitPrice,
          subtotal: breakdown.subtotal,
          setupTotal: breakdown.setupTotal,
          total: breakdown.total,
          quantity,
        },
        asQuote,
      };

      const res = asQuote ? await saveDraftAction(input) : await submitDesignAction(input);
      if ("needsLogin" in res && res.needsLogin) {
        router.push(`/login?next=${encodeURIComponent(`/design/${props.productId}`)}`);
        return;
      }
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if (asQuote && "designId" in res) {
        router.push("/account/designs");
      } else if ("orderId" in res && res.orderId) {
        router.push(`/account/orders/${res.orderId}?placed=1`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const zoomIdx = ZOOM_STEPS.indexOf(zoom) === -1 ? 3 : ZOOM_STEPS.indexOf(zoom);

  return (
    <div className="flex min-h-dvh flex-col bg-dream-cream text-dream-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-dream-line bg-dream-lavender-soft px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/shop/${props.productId}`}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium text-dream-purple transition-colors hover:bg-white/60"
          >
            <span aria-hidden>←</span> Back
          </Link>
          <span className="truncate font-display text-base font-bold">{props.productName}</span>
          {props.brand && <span className="hidden text-xs text-dream-ink-soft sm:inline">{props.brand}</span>}
        </div>
        <Link href="/" className="flex shrink-0 items-center">
          <Image src="/dreamhouse-logo-full.png" alt="Dreamhouse Printing" width={900} height={300} className="h-8 w-auto" priority />
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:gap-5 lg:p-5">
        {/* Left rail — tools + colours */}
        <aside className="order-2 w-full shrink-0 space-y-4 lg:order-1 lg:w-72">
          <section className="rounded-2xl border border-dream-line bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-display text-sm font-bold text-dream-ink">Add to your design</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <ToolButton label="Upload art" onClick={() => fileInputRef.current?.click()} icon={<UploadIcon />} />
              <ToolButton label="Add text" onClick={addText} icon={<TextIcon />} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,application/pdf"
              hidden
              onChange={onPickFile}
            />
            <p className="mt-2.5 text-xs leading-relaxed text-dream-faint">
              PNG, JPG, SVG or PDF. We&apos;ll send a free proof before anything prints.
            </p>
          </section>

          <section className="rounded-2xl border border-dream-line bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-dream-ink">Colour</h3>
              <span className="truncate rounded-full bg-dream-lavender-soft px-2.5 py-0.5 text-xs font-semibold text-dream-purple">
                {colourName || "—"}
              </span>
            </div>
            <div className="no-scrollbar flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1">
              {props.colours.map((c) => (
                <button
                  key={c.name}
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={colourName === c.name}
                  onClick={() => setColourName(c.name)}
                  className={cn(
                    "h-8 w-8 rounded-full border transition-transform hover:scale-110",
                    colourName === c.name
                      ? "border-dream-purple ring-2 ring-dream-purple/40"
                      : "border-dream-line-strong"
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </section>
        </aside>

        {/* Center — canvas */}
        <main className="order-1 flex min-w-0 flex-1 flex-col items-center lg:order-2">
          {views.length > 1 && (
            <div className="mb-3 inline-flex gap-1 rounded-full border border-dream-line bg-white p-1 shadow-sm">
              {views.map((v) => (
                <button
                  key={v}
                  onClick={() => changeView(v)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                    v === view ? "bg-dream-purple text-white" : "text-dream-muted hover:text-dream-ink"
                  )}
                >
                  {VIEW_LABEL[v]}
                </button>
              ))}
            </div>
          )}

          {/* Soft framed canvas card */}
          <div className="relative w-full max-w-2xl overflow-auto rounded-3xl border border-dream-line bg-white p-4 shadow-[0_10px_40px_-12px_rgba(118,100,255,0.28)] sm:p-6">
            <div
              className="mx-auto w-fit transition-transform duration-150"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
            >
              <DesignCanvas
                ref={canvasRef}
                onSelectionChange={setHasSelection}
                onChange={onCanvasChange}
                onGarmentLoaded={() => setGarmentLoading(false)}
              />
            </div>

            {/* Empty hint */}
            {!hasArt && !garmentLoading && (
              <div className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-col items-center gap-1 px-6 text-center">
                <span className="rounded-full bg-dream-ink/75 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
                  Upload your logo or add text to start designing
                </span>
              </div>
            )}

            {/* Loading shimmer */}
            {garmentLoading && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl bg-white/60">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-dream-line border-t-dream-purple" />
              </div>
            )}
          </div>

          {/* Zoom + undo toolbar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-full border border-dream-line bg-white p-1 shadow-sm">
              <IconBtn
                label="Zoom out"
                disabled={zoomIdx <= 0}
                onClick={() => setZoom(ZOOM_STEPS[Math.max(0, zoomIdx - 1)])}
              >
                <MinusIcon />
              </IconBtn>
              <button
                onClick={() => setZoom(1)}
                className="min-w-[3rem] rounded-full px-2 text-xs font-semibold text-dream-muted hover:text-dream-ink"
              >
                {Math.round(zoom * 100)}%
              </button>
              <IconBtn
                label="Zoom in"
                disabled={zoomIdx >= ZOOM_STEPS.length - 1}
                onClick={() => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIdx + 1)])}
              >
                <PlusIcon />
              </IconBtn>
            </div>
            <button
              onClick={undo}
              disabled={!canUndo}
              className="inline-flex items-center gap-1.5 rounded-full border border-dream-line bg-white px-3 py-2 text-sm font-medium text-dream-ink shadow-sm transition-colors hover:bg-dream-cream disabled:opacity-40"
            >
              <UndoIcon /> Undo
            </button>
          </div>

          {/* Object toolbar */}
          <div className="mt-3 flex min-h-[2.5rem] items-center gap-1.5">
            {hasSelection ? (
              <>
                <ChipBtn onClick={() => canvasRef.current?.bringForward()}>Bring forward</ChipBtn>
                <ChipBtn onClick={() => canvasRef.current?.sendBackward()}>Send back</ChipBtn>
                <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-dream-line bg-white shadow-sm" title="Text colour">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => applyTextColor(e.target.value)}
                    className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  />
                </label>
                <ChipBtn onClick={deleteActive}>Delete</ChipBtn>
              </>
            ) : (
              <p className="text-xs text-dream-faint">Drag to move · corner handles resize/rotate · click text to edit</p>
            )}
          </div>
        </main>

        {/* Right rail — order */}
        <aside className="order-3 w-full shrink-0 space-y-4 lg:w-80">
          {/* Price panel */}
          <section className="relative overflow-hidden rounded-2xl border border-dream-line bg-gradient-to-br from-white to-dream-lavender-soft/50 p-4 shadow-sm">
            <div className="relative z-10">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-dream-purple">Your estimate</div>
              <div className="font-display text-4xl font-extrabold leading-tight text-dream-ink">{formatCAD(breakdown.total)}</div>
              <div className="text-sm text-dream-ink-soft">
                {formatCAD(breakdown.unitPrice)} / item · {quantity || 0} pcs
              </div>
              {breakdown.setupTotal > 0 && (
                <div className="text-xs text-dream-faint">includes {formatCAD(breakdown.setupTotal)} one-time setup</div>
              )}
            </div>
            <Image
              src="/testimonailsplusfooter/dogasset.png"
              alt=""
              aria-hidden
              width={120}
              height={205}
              className="pointer-events-none absolute -bottom-2 right-1 h-20 w-auto opacity-90"
            />
          </section>

          {/* Decoration */}
          <section className="rounded-2xl border border-dream-line bg-white p-4 shadow-sm">
            <h3 className="mb-2.5 font-display text-sm font-bold text-dream-ink">Decoration method</h3>
            <div className="space-y-1.5">
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
            {method && method.per_color_cost > 0 && (
              <div className="mt-3">
                <label className="text-xs font-medium text-dream-muted">Ink colours</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={inkColours}
                  onChange={(e) => setInkColours(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-dream-line px-3 py-2 text-sm focus-visible:border-dream-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
                />
              </div>
            )}
          </section>

          {/* Sizes & quantity */}
          <section className="rounded-2xl border border-dream-line bg-white p-4 shadow-sm">
            <h3 className="mb-2.5 font-display text-sm font-bold text-dream-ink">Sizes &amp; quantity</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
              {props.sizes.map((s) => {
                const val = sizeQty[s.name] ?? 0;
                return (
                  <label
                    key={s.name}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 transition-colors",
                      val > 0 ? "border-dream-purple bg-dream-lavender-soft/50" : "border-dream-line"
                    )}
                  >
                    <span className="text-[11px] font-semibold uppercase text-dream-muted">{s.name}</span>
                    <input
                      type="number"
                      min={0}
                      value={sizeQty[s.name] ?? ""}
                      placeholder="0"
                      onChange={(e) => setSizeQty((q) => ({ ...q, [s.name]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="w-full bg-transparent text-center text-sm font-semibold text-dream-ink placeholder:font-normal placeholder:text-dream-faint focus:outline-none"
                    />
                  </label>
                );
              })}
            </div>
          </section>

          {/* CTAs */}
          <div className="space-y-2.5">
            {error && <p className="rounded-xl bg-dream-danger-soft px-3 py-2 text-sm text-dream-danger">{error}</p>}
            <button
              onClick={() => finalize(false)}
              disabled={busy !== null}
              className="rough-pill rough-pill-filled inline-flex w-full items-center justify-center px-6 py-3.5 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {busy === "submit" ? "Working…" : props.isLoggedIn ? "Start your order" : "Log in to order"}
            </button>
            <button
              onClick={() => finalize(true)}
              disabled={busy !== null}
              className="inline-flex w-full items-center justify-center rounded-full border border-dream-line bg-white px-6 py-3 font-display text-sm font-bold text-dream-ink transition-colors hover:bg-dream-cream disabled:opacity-60"
            >
              {busy === "save" ? "Saving…" : "Save & finish later"}
            </button>
            <p className="text-center text-xs text-dream-faint">No payment now — we confirm your quote first.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------- bits --------------------------------- */

function ToolButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dream-line bg-dream-cream/60 px-3 py-4 text-sm font-semibold text-dream-ink transition-all hover:-translate-y-0.5 hover:border-dream-purple hover:bg-dream-lavender-soft/60"
    >
      <span className="text-dream-purple">{icon}</span>
      {label}
    </button>
  );
}

function ChipBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-dream-line bg-white px-3 py-1.5 text-xs font-medium text-dream-ink shadow-sm transition-colors hover:bg-dream-cream"
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

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4m0 0L7 9m5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
function TextIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V5h16v2M9 19h6M12 5v14" />
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
