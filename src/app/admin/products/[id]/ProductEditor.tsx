"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { garmentRetailUnit } from "@/lib/pricing/platform";
import type { ProductRow, CategoryRow, DecorationMethodRow, PrintAreaRow, ProductColourJson, ProductSizeJson, ProductQuoteCurveJson, QuoteDecoration } from "@/lib/db/rows";
import { updateProductAction, syncProductAction, setProductFlagsAction } from "../actions";
import { PrintAreaEditor } from "./PrintAreaEditor";

type Colour = ProductColourJson & { enabled?: boolean };
type Size = ProductSizeJson & { enabled?: boolean };

export function ProductEditor({
  product,
  printAreas,
  categories,
  methods,
}: {
  product: ProductRow;
  printAreas: PrintAreaRow[];
  categories: CategoryRow[];
  methods: DecorationMethodRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, startSave] = useTransition();
  const [syncing, startSync] = useTransition();

  const colours = (product.colours ?? []) as unknown as Colour[];
  const sizes = (product.sizes ?? []) as unknown as Size[];

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [categoryId, setCategoryId] = useState(product.category_id ?? "");
  const [markupType, setMarkupType] = useState<"percent" | "flat">(product.markup_type as "percent" | "flat");
  const [markupValue, setMarkupValue] = useState(String(product.markup_value ?? 0));
  const [leadTime, setLeadTime] = useState(String(product.lead_time_days ?? 7));
  const [stockStatus, setStockStatus] = useState(product.stock_status);
  const [allowed, setAllowed] = useState<Set<string>>(
    new Set((product.allowed_decoration_method_ids ?? []) as string[])
  );
  const [enColours, setEnColours] = useState<Set<string>>(
    new Set(colours.filter((c) => c.enabled !== false).map((c) => c.name))
  );
  const [enSizes, setEnSizes] = useState<Set<string>>(
    new Set(sizes.filter((s) => s.enabled !== false).map((s) => s.name))
  );
  const [isActive, setIsActive] = useState(product.is_active);
  const [isFeatured, setIsFeatured] = useState(product.is_featured);

  // Storefront Detailed Quote curve (pricing_rules.quote). Rows are edited as
  // strings; parsed + sorted on save. decorations is fixed (set by the seed).
  const initialCurve = (product.pricing_rules as { quote?: ProductQuoteCurveJson } | null)?.quote;
  const [quoteDecorations] = useState<QuoteDecoration[]>(initialCurve?.decorations ?? []);
  const [quoteBreaks, setQuoteBreaks] = useState<Record<string, { minQty: string; price: string }[]>>(() => {
    const out: Record<string, { minQty: string; price: string }[]> = {};
    for (const d of initialCurve?.decorations ?? []) {
      out[d] = (initialCurve?.breaks[d] ?? []).map((b) => ({ minQty: String(b.minQty), price: String(b.price) }));
    }
    return out;
  });

  function setBreakRow(deco: string, idx: number, field: "minQty" | "price", val: string) {
    setQuoteBreaks((prev) => ({
      ...prev,
      [deco]: prev[deco].map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    }));
  }
  function addBreakRow(deco: string) {
    setQuoteBreaks((prev) => ({ ...prev, [deco]: [...(prev[deco] ?? []), { minQty: "", price: "" }] }));
  }
  function removeBreakRow(deco: string, idx: number) {
    setQuoteBreaks((prev) => ({ ...prev, [deco]: prev[deco].filter((_, i) => i !== idx) }));
  }

  /** Build the curve to persist, or undefined when the product has no curve. */
  function buildQuoteCurve(): ProductQuoteCurveJson | undefined {
    if (quoteDecorations.length === 0) return undefined;
    const breaks: ProductQuoteCurveJson["breaks"] = {};
    for (const d of quoteDecorations) {
      breaks[d] = (quoteBreaks[d] ?? [])
        .map((r) => ({ minQty: Math.max(1, Math.round(Number(r.minQty) || 0)), price: Number(r.price) || 0 }))
        .filter((r) => r.price > 0)
        .sort((a, b) => a.minQty - b.minQty);
    }
    return { decorations: quoteDecorations, breaks };
  }

  const retailPreview = useMemo(
    () =>
      garmentRetailUnit({
        wholesale_cost: product.wholesale_cost,
        base_price: null,
        markup_type: markupType,
        markup_value: Number(markupValue) || 0,
        pricing_rules: product.pricing_rules,
      }),
    [product.wholesale_cost, markupType, markupValue, product.pricing_rules]
  );

  // Setup checklist — computed from the saved product (plus the live Active
  // switch, which persists immediately). Drives the "not visible yet" banner.
  const setupSteps = [
    {
      done: Boolean(product.category_id),
      label: "Choose a category",
      hint: "So it lands in the right Shop All aisle.",
      href: "#pe-details",
    },
    {
      done: product.markup_value != null || product.base_price != null,
      label: "Review pricing",
      hint: "100% markup is applied by default — adjust if needed.",
      href: "#pe-pricing",
    },
    {
      done: printAreas.length > 0,
      label: "Draw a print area",
      hint: "Required so it opens in the designer.",
      href: "#pe-print-areas",
    },
    {
      done: isActive,
      label: "Turn on Active",
      hint: "Makes it visible in the shop.",
      href: "#pe-visibility",
    },
  ];
  const doneCount = setupSteps.filter((s) => s.done).length;
  const fullyLive = doneCount === setupSteps.length;

  const majors = categories.filter((c) => c.is_major && !c.parent_id);
  const niche = categories.filter((c) => !c.is_major && !c.parent_id);
  const subsOf = (id: string) => categories.filter((c) => c.parent_id === id);

  function toggle(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  function save() {
    startSave(async () => {
      const res = await updateProductAction(product.id, {
        name,
        description,
        categoryId: categoryId || null,
        markupType,
        markupValue: Number(markupValue) || 0,
        leadTimeDays: Number(leadTime) || 7,
        stockStatus: stockStatus as "in_stock" | "out_of_stock" | "made_to_order",
        allowedDecorationMethodIds: [...allowed],
        enabledColours: [...enColours],
        enabledSizes: [...enSizes],
        quoteCurve: buildQuoteCurve(),
      });
      if (res.error) toast({ title: "Save failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Saved", variant: "success" });
        router.refresh();
      }
    });
  }

  function sync() {
    startSync(async () => {
      const res = await syncProductAction(product.id);
      if (res.error) toast({ title: "Sync failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Synced from S&S", variant: "success" });
        router.refresh();
      }
    });
  }

  async function flag(next: { isActive?: boolean; isFeatured?: boolean }) {
    if (next.isActive !== undefined) setIsActive(next.isActive);
    if (next.isFeatured !== undefined) setIsFeatured(next.isFeatured);
    const res = await setProductFlagsAction(product.id, next);
    if (res.error) {
      toast({ title: "Update failed", description: res.error, variant: "error" });
      router.refresh();
    }
  }

  return (
    <div>
      <AdminHeader
        title={product.name}
        badge={
          fullyLive ? (
            <Badge variant="success">Live in shop</Badge>
          ) : (
            <Badge variant={isActive ? "success" : "neutral"}>{isActive ? "Active" : "Inactive"}</Badge>
          )
        }
      >
        <Button variant="ghost" onClick={() => router.push("/admin/products")}>
          ← All products
        </Button>
        <Button variant="secondary" onClick={sync} loading={syncing}>
          Sync from S&amp;S
        </Button>
        <Button variant="primary" onClick={save} loading={saving}>
          Save changes
        </Button>
      </AdminHeader>

      {!fullyLive && (
        <div className="px-8 pt-6">
          <Card className="border-dream-warn/40 bg-dream-warn-soft/40">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-dream-ink">
                    This product isn&apos;t visible in the shop yet
                  </h3>
                  <p className="mt-0.5 text-sm text-dream-muted">
                    Finish these steps, then it goes live for customers.
                  </p>
                </div>
                <Badge variant="warn" className="shrink-0">
                  {doneCount}/{setupSteps.length} done
                </Badge>
              </div>
              <ul className="mt-4 space-y-1">
                {setupSteps.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-dream-surface/70"
                    >
                      {s.done ? (
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="mt-0.5 h-4 w-4 shrink-0 text-dream-success"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.71-9.29a1 1 0 00-1.42-1.42L9 10.59 7.71 9.3a1 1 0 00-1.42 1.4l2 2a1 1 0 001.42 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="mt-0.5 h-4 w-4 shrink-0 text-dream-line-strong"
                          aria-hidden="true"
                        >
                          <circle cx="10" cy="10" r="7" />
                        </svg>
                      )}
                      <span>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            s.done ? "text-dream-muted line-through" : "text-dream-ink"
                          )}
                        >
                          {s.label}
                        </span>
                        {!s.done && <span className="block text-xs text-dream-muted">{s.hint}</span>}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 px-8 py-6 lg:grid-cols-3">
        {/* Main config */}
        <div className="space-y-6 lg:col-span-2">
          <Card id="pe-details" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Description">
                <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <Field label="Category" hint="Drives where it appears on Shop All.">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">— Uncategorized —</option>
                  {majors.map((m) => (
                    <optgroup key={m.id} label={m.name}>
                      <option value={m.id}>{m.name} (all)</option>
                      {subsOf(m.id).map((s) => (
                        <option key={s.id} value={s.id}>
                          {m.name} › {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {niche.length > 0 && (
                    <optgroup label="Other">
                      {niche.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Colours offered</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-dream-muted">
                {enColours.size} of {colours.length} S&amp;S colours enabled. Click to toggle.
              </p>
              <div className="flex flex-wrap gap-2">
                {colours.map((c) => {
                  const on = enColours.has(c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setEnColours(toggle(enColours, c.name))}
                      className={cn(
                        "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs",
                        on ? "border-dream-purple bg-dream-lavender-soft text-dream-ink" : "border-dream-line text-dream-muted opacity-60"
                      )}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-dream-line-strong"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sizes offered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const on = enSizes.has(s.name);
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setEnSizes(toggle(enSizes, s.name))}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium",
                        on ? "border-dream-purple bg-dream-lavender-soft text-dream-ink" : "border-dream-line text-dream-muted opacity-60"
                      )}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div id="pe-print-areas" className="scroll-mt-24">
            <PrintAreaEditor productId={product.id} initialAreas={printAreas} colours={colours} />
          </div>
        </div>

        {/* Sidebar: pricing, decoration, flags */}
        <div className="space-y-6">
          <Card id="pe-visibility" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Visibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-dream-muted">Show on storefront & designer</p>
                </div>
                <Switch checked={isActive} onCheckedChange={(v) => flag({ isActive: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Featured</Label>
                  <p className="text-xs text-dream-muted">Top-5 favourites row</p>
                </div>
                <Switch checked={isFeatured} onCheckedChange={(v) => flag({ isFeatured: v })} />
              </div>
            </CardContent>
          </Card>

          <Card id="pe-pricing" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-dream-bg px-3 py-2 text-sm">
                <div className="flex justify-between text-dream-muted">
                  <span>S&amp;S wholesale</span>
                  <span>{formatCAD(product.wholesale_cost ?? 0)}</span>
                </div>
                <div className="mt-1 flex justify-between font-semibold text-dream-ink">
                  <span>Retail / unit</span>
                  <span>{formatCAD(retailPreview)}</span>
                </div>
              </div>
              <Field label="Markup type">
                <Select value={markupType} onChange={(e) => setMarkupType(e.target.value as "percent" | "flat")}>
                  <option value="percent">Percent (%)</option>
                  <option value="flat">Flat ($)</option>
                </Select>
              </Field>
              <Field label={markupType === "percent" ? "Markup %" : "Markup $"}>
                <Input type="number" value={markupValue} onChange={(e) => setMarkupValue(e.target.value)} />
              </Field>
              <Field label="Lead time (days)">
                <Input type="number" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
              </Field>
              <Field label="Stock status">
                <Select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}>
                  <option value="in_stock">In stock</option>
                  <option value="out_of_stock">Out of stock</option>
                  <option value="made_to_order">Made to order</option>
                </Select>
              </Field>
            </CardContent>
          </Card>

          {/* Storefront Detailed Quote price/tiers (pricing_rules.quote) */}
          {quoteDecorations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Quote pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-xs text-dream-muted">
                  Per-unit price by quantity, shown on the product page Detailed Quote. Lower price = higher
                  quantity. Saved with Save changes.
                </p>
                {quoteDecorations.map((deco) => (
                  <div key={deco}>
                    <Label>{deco === "screen" ? "Screen print" : "Embroidery"}</Label>
                    <div className="mt-2 space-y-1.5">
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-dream-muted">
                        <span>Min qty</span>
                        <span>$ / unit</span>
                        <span className="w-7" />
                      </div>
                      {(quoteBreaks[deco] ?? []).map((row, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            value={row.minQty}
                            onChange={(e) => setBreakRow(deco, i, "minQty", e.target.value)}
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.price}
                            onChange={(e) => setBreakRow(deco, i, "price", e.target.value)}
                          />
                          <button
                            type="button"
                            aria-label="Remove tier"
                            onClick={() => removeBreakRow(deco, i)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-dream-muted hover:bg-dream-bg hover:text-dream-ink"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => addBreakRow(deco)}>
                        + Add tier
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Decoration methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-dream-muted">Which techniques this product allows.</p>
              {methods.map((m) => (
                <Checkbox
                  key={m.id}
                  label={m.name}
                  checked={allowed.has(m.id)}
                  onChange={() => setAllowed(toggle(allowed, m.id))}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
