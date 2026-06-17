"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { DesignCanvas, type DesignCanvasHandle, type PrintBox } from "./DesignCanvas";
import { submitDesignAction, saveDraftAction, type DesignSubmitInput } from "./actions";
import { Button } from "@/components/ui/Button";
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

export function DesignerClient(props: Props) {
  const router = useRouter();
  const canvasRef = useRef<DesignCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevViewRef = useRef<View | null>(null);

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
    c.setGarment(imageForView(colour, view));
    c.setPrintArea(boxForView(view));
    if (prevViewRef.current !== view) {
      const saved = scenes[view];
      if (saved) c.loadScene(saved);
      else c.clearArt();
      prevViewRef.current = view;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colourName, view]);

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
    canvasRef.current?.addText("Your text");
    onCanvasChange();
  }

  function applyTextColor(hex: string) {
    setTextColor(hex);
    canvasRef.current?.setActiveColor(hex);
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

  return (
    <div className="flex h-screen flex-col bg-dream-bg text-dream-ink">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-dream-line bg-dream-surface px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href={`/shop/${props.productId}`} className="text-sm text-dream-muted hover:text-dream-ink">
            ← Back
          </Link>
          <span className="font-display font-bold">{props.productName}</span>
          {props.brand && <span className="text-xs text-dream-muted">{props.brand}</span>}
        </div>
        <Link href="/" className="flex items-center gap-1.5">
          <Image src="/dreamhouse-logo.svg" alt="" width={24} height={24} />
          <span className="font-display text-sm font-bold">Dreamhouse</span>
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left rail — tools + colours */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-dream-line bg-dream-surface p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-dream-muted">Add to design</h3>
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-start" onClick={() => fileInputRef.current?.click()}>
              ⬆ Upload artwork
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={addText}>
              T  Add text
            </Button>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" hidden onChange={onPickFile} />
          </div>

          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-dream-muted">
            Colour — {colourName}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {props.colours.map((c) => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => setColourName(c.name)}
                className={cn(
                  "h-7 w-7 rounded-full border",
                  colourName === c.name ? "border-dream-purple ring-2 ring-dream-purple/40" : "border-dream-line-strong"
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </aside>

        {/* Center — canvas */}
        <main className="flex min-w-0 flex-1 flex-col items-center overflow-y-auto p-4">
          {views.length > 1 && (
            <div className="mb-3 flex gap-1 rounded-lg bg-dream-surface p-1 shadow-sm">
              {views.map((v) => (
                <button
                  key={v}
                  onClick={() => changeView(v)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium",
                    v === view ? "bg-dream-purple text-white" : "text-dream-muted hover:text-dream-ink"
                  )}
                >
                  {VIEW_LABEL[v]}
                </button>
              ))}
            </div>
          )}

          <DesignCanvas ref={canvasRef} onSelectionChange={setHasSelection} onChange={onCanvasChange} />

          {/* Object toolbar */}
          <div className="mt-3 flex h-10 items-center gap-2">
            {hasSelection ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => canvasRef.current?.bringForward()}>
                  Bring forward
                </Button>
                <Button variant="ghost" size="sm" onClick={() => canvasRef.current?.sendBackward()}>
                  Send back
                </Button>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => applyTextColor(e.target.value)}
                  title="Text colour"
                  className="h-8 w-8 cursor-pointer rounded border border-dream-line"
                />
                <Button variant="ghost" size="sm" onClick={() => { canvasRef.current?.deleteActive(); onCanvasChange(); }}>
                  Delete
                </Button>
              </>
            ) : (
              <p className="text-xs text-dream-muted">Drag to move · corner handles to resize/rotate · click art to edit</p>
            )}
          </div>
        </main>

        {/* Right rail — order */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-dream-line bg-dream-surface">
          <div className="border-b border-dream-line p-4">
            <div className="text-xs uppercase tracking-wide text-dream-muted">Estimated</div>
            <div className="font-display text-3xl font-bold text-dream-ink">{formatCAD(breakdown.total)}</div>
            <div className="text-sm text-dream-muted">{formatCAD(breakdown.unitPrice)} / unit · {quantity || 0} pcs</div>
            {breakdown.setupTotal > 0 && (
              <div className="text-xs text-dream-muted">includes {formatCAD(breakdown.setupTotal)} setup</div>
            )}
          </div>

          <div className="border-b border-dream-line p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-dream-muted">Decoration</h3>
            <div className="space-y-1.5">
              {props.methods.map((m) => (
                <label key={m.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", methodId === m.id ? "border-dream-purple bg-dream-lavender-soft" : "border-dream-line")}>
                  <input type="radio" name="method" checked={methodId === m.id} onChange={() => setMethodId(m.id)} />
                  {m.name}
                </label>
              ))}
            </div>
            {method && method.per_color_cost > 0 && (
              <div className="mt-3">
                <label className="text-xs text-dream-muted">Ink colours</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={inkColours}
                  onChange={(e) => setInkColours(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-dream-line px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <div className="border-b border-dream-line p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-dream-muted">Sizes & quantity</h3>
            <div className="grid grid-cols-3 gap-2">
              {props.sizes.map((s) => (
                <label key={s.name} className="flex flex-col">
                  <span className="text-xs text-dream-muted">{s.name}</span>
                  <input
                    type="number"
                    min={0}
                    value={sizeQty[s.name] ?? ""}
                    placeholder="0"
                    onChange={(e) => setSizeQty((q) => ({ ...q, [s.name]: Math.max(0, Number(e.target.value) || 0) }))}
                    className="mt-0.5 w-full rounded-lg border border-dream-line px-2 py-1.5 text-sm"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-auto space-y-2 p-4">
            {error && <p className="rounded-lg bg-dream-danger-soft px-3 py-2 text-sm text-dream-danger">{error}</p>}
            <Button variant="primary" size="lg" className="w-full" loading={busy === "submit"} onClick={() => finalize(false)}>
              {props.isLoggedIn ? "Start your order" : "Log in to order"}
            </Button>
            <Button variant="secondary" className="w-full" loading={busy === "save"} onClick={() => finalize(true)}>
              Save &amp; finish later
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
