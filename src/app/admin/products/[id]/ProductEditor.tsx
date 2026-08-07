"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
import { decorationForMethodSlug } from "@/lib/pricing/quote";
import { compileCurveFromProfile, normalizeProfile, blankShift, profileIdForProduct } from "@/lib/pricing/profile";
import { productPrimaryImage, colourCardImage } from "@/lib/productImage";
import type { ProductRow, CategoryRow, DecorationMethodRow, PrintAreaRow, ProductColourJson, ProductSizeJson, ProductQuoteCurveJson, QuoteDecoration, QuotePriceBreak, PricingProfileRow } from "@/lib/db/rows";
import { InfoTip } from "@/components/ui/InfoTip";
import { updateProductAction, syncProductAction, setProductFlagsAction } from "../actions";
import { PrintAreaEditor } from "./PrintAreaEditor";
import { swatchStyle } from "@/lib/swatch";

type Colour = ProductColourJson & { enabled?: boolean; primary?: boolean };
type Size = ProductSizeJson & { enabled?: boolean };

const DECO_LABEL: Record<QuoteDecoration, string> = { screen: "Screen print", embroidery: "Embroidery" };
// Representative quantities shown in the live price preview (not every tier).
const PREVIEW_QTYS = [1, 12, 25, 50, 100, 250, 500];

/** Price at a quantity from a sorted tier list (each tier applies up to the next). */
function tierPriceAt(breaks: QuotePriceBreak[], qty: number): number {
  let price = breaks[0]?.price ?? 0;
  for (const b of breaks) {
    if (qty >= b.minQty) price = b.price;
    else break;
  }
  return price;
}

export function ProductEditor({
  product,
  printAreas,
  categories,
  methods,
  profiles,
}: {
  product: ProductRow;
  printAreas: PrintAreaRow[];
  categories: CategoryRow[];
  methods: DecorationMethodRow[];
  profiles: PricingProfileRow[];
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
  const [thumbColour, setThumbColour] = useState<string | null>(
    colours.find((c) => c.primary)?.name ?? null
  );
  const [thumbView, setThumbView] = useState<"model" | "flat">(
    colours.find((c) => c.primary)?.primaryView === "flat" ? "flat" : "model"
  );
  const [enSizes, setEnSizes] = useState<Set<string>>(
    new Set(sizes.filter((s) => s.enabled !== false).map((s) => s.name))
  );
  const [isActive, setIsActive] = useState(product.is_active);
  const [isFeatured, setIsFeatured] = useState(product.is_featured);

  // Customer pricing = the product's blank (wholesale + markup) + a shared
  // decoration profile. The curve is compiled live for preview here and again
  // on the server at save. New/curve-less products start with no profile.
  const [profileId, setProfileId] = useState<string>(profileIdForProduct(product) ?? "");

  // Live blank input from the current markup edits (base_price ignored for the
  // shift, which is purely blank-cost-driven).
  const blankInput = useMemo(
    () => ({
      wholesale_cost: product.wholesale_cost,
      base_price: null,
      markup_type: markupType,
      markup_value: Number(markupValue) || 0,
      pricing_rules: product.pricing_rules,
    }),
    [product.wholesale_cost, product.pricing_rules, markupType, markupValue]
  );

  const selectedProfile = useMemo(() => profiles.find((p) => p.id === profileId) ?? null, [profiles, profileId]);
  const previewCurve = useMemo<ProductQuoteCurveJson | null>(
    () => (selectedProfile ? compileCurveFromProfile(blankInput, normalizeProfile(selectedProfile)) : null),
    [selectedProfile, blankInput]
  );
  const previewShift = useMemo(
    () => (selectedProfile ? blankShift(blankInput, { refWholesale: selectedProfile.ref_wholesale }) : 0),
    [selectedProfile, blankInput]
  );

  // Which decoration axes are actually priced (drives the "customers see this
  // method" hints below).
  const pricedAxes = useMemo(() => {
    const out = new Set<QuoteDecoration>();
    if (previewCurve) {
      for (const d of previewCurve.decorations) {
        if ((previewCurve.breaks[d] ?? []).length > 0) out.add(d);
      }
    }
    return out;
  }, [previewCurve]);
  const hasPricedCurve = pricedAxes.size > 0;
  function methodCustomerVisible(slug: string): boolean {
    if (!hasPricedCurve) return true; // curve-less products fall back to cost-plus
    const axis = decorationForMethodSlug(slug);
    return axis !== null && pricedAxes.has(axis);
  }
  const visibleEnabledCount = methods.filter((m) => allowed.has(m.id) && methodCustomerVisible(m.slug)).length;

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

  // Setup checklist: pricing step is done once a profile is chosen and yields
  // priced tiers (turns green live, before save).
  const setupSteps = [
    {
      // Live off the picker, not the saved row, so choosing a category ticks
      // the step immediately (Active and pricing already behave this way).
      done: Boolean(categoryId),
      label: "Choose a category",
      hint: "So it lands in the right Shop All aisle.",
      href: "#pe-details",
    },
    {
      done: hasPricedCurve,
      label: "Set customer pricing",
      hint: "Pick a decoration pricing profile.",
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
  /** Which setup step the admin jumped to, so its section stays ringed until
   *  they pick another. Cleared once the step is finished. */
  const [focusStep, setFocusStep] = useState<string | null>(null);
  const stepRing = (id: string) => {
    if (focusStep !== id) return "";
    // The ring drops off by itself the moment the step is satisfied, so it
    // never lingers on a section that no longer needs attention.
    const step = setupSteps.find((s) => s.href === `#${id}`);
    return step && !step.done ? "ring-2 ring-dream-danger ring-offset-2 ring-offset-dream-bg" : "";
  };

  // Thumbnail picker: only enabled colours that actually have a front photo are
  // selectable. Preview mirrors what the shop card will show (falls back to auto).
  const thumbOptions = colours.filter((c) => enColours.has(c.name) && (c.images?.front || c.images?.model));
  const thumbColourObj = thumbColour ? colours.find((c) => c.name === thumbColour) : null;
  const thumbHasModel = !!thumbColourObj?.images?.model;
  const thumbPreview =
    (thumbColourObj ? colourCardImage(thumbColourObj, thumbView) : null) ?? productPrimaryImage(product);

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
        thumbnailColour: thumbColour && enColours.has(thumbColour) ? thumbColour : null,
        thumbnailView: thumbView,
        profileId: profileId || null,
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
          <>
            {product.ss_style_name && (
              <span
                className="rounded-full border border-dream-line bg-dream-bg px-2.5 py-0.5 text-xs font-semibold tracking-wide text-dream-muted"
                title={product.brand ? `${product.brand} style ${product.ss_style_name}` : undefined}
              >
                SKU {product.ss_style_name}
              </span>
            )}
            {fullyLive ? (
              <Badge variant="success">Live in shop</Badge>
            ) : (
              <Badge variant={isActive ? "success" : "neutral"}>{isActive ? "Active" : "Inactive"}</Badge>
            )}
          </>
        }
      >
        <Button variant="ghost" onClick={() => router.push("/admin/products")}>
          All products
        </Button>
        {/* Opens the real /shop/[id] page in a new tab. For inactive products
            the shop page lets staff through as a 1:1 draft preview. */}
        <a
          href={`/shop/${product.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-dream-line bg-white px-4 font-display text-sm font-medium text-dream-ink transition-colors hover:bg-dream-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
        >
          {isActive ? "View live page" : "Preview in shop"}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-dream-muted" aria-hidden="true">
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </a>
        <Button variant="secondary" onClick={sync} loading={syncing}>
          Sync from S&amp;S
        </Button>
        <Button variant="primary" onClick={save} loading={saving}>
          Save changes
        </Button>
      </AdminHeader>

      {/* Stays put once every step is ticked: the banner flips green and
          confirms the product is live, instead of vanishing and leaving the
          admin unsure whether the last step actually registered. */}
      <div className="px-8 pt-6">
          {/* White like every other admin card (grey body text is legible on it,
              which it isn't on a saturated cream), with a coloured left accent
              carrying the status signal. */}
          <Card className="overflow-hidden">
            <CardContent className={cn("border-l-4 p-5", fullyLive ? "border-dream-success" : "border-dream-danger")}>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <h3 className="font-display text-base font-semibold text-dream-ink">
                    {fullyLive ? "Setup complete, this product is live" : "This product isn't visible in the shop yet"}
                  </h3>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      fullyLive ? "text-dream-success" : "text-dream-danger"
                    )}
                  >
                    {doneCount} of {setupSteps.length} done
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-dream-muted">
                  {fullyLive
                    ? "Customers can find it in the shop, open it in the designer and order it."
                    : "Finish these steps, then it goes live for customers."}
                </p>
              </div>
              {/* Done: the banner is just the green confirmation line, no
                  checklist. Unfinished: the full actionable list. */}
              {!fullyLive && (
                /* Same circle language as the order stage stepper: filled green
                   check when done, outlined dot when not, label centered on it. */
                <ul className="mt-4 space-y-1">
                  {setupSteps.map((s) => (
                    <li key={s.label}>
                      <a
                        href={s.href}
                        onClick={() => setFocusStep(s.done ? null : s.href.slice(1))}
                        className={cn(
                          "-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors",
                          focusStep === s.href.slice(1) && !s.done ? "bg-dream-danger-soft" : "hover:bg-dream-bg"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                            s.done
                              ? "border-dream-success bg-dream-success text-white"
                              : "border-dream-line-strong bg-white"
                          )}
                        >
                          {s.done && (
                            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
                              <path
                                d="M3.5 8.5l3 3 6-6.5"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="min-w-0 leading-tight">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              s.done ? "text-dream-muted line-through" : "text-dream-ink"
                            )}
                          >
                            {s.label}
                          </span>
                          {!s.done && <span className="mt-0.5 block text-xs text-dream-muted">{s.hint}</span>}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

      <div className="grid gap-6 px-8 py-6 lg:grid-cols-3">
        {/* Main config */}
        <div className="space-y-6 lg:col-span-2">
          <Card id="pe-details" className={cn("scroll-mt-24 transition-shadow", stepRing("pe-details"))}>
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
                  <option value="">Uncategorized</option>
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
                Customers can pick {enColours.size} of the {colours.length} colours S&amp;S offers.
                Click a swatch to turn it on or off.
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
                        style={swatchStyle(c)}
                      />
                      {c.name}
                    </button>
                  );
                })}
              </div>

              {/* Card thumbnail, which colour + which shot shows on Shop All. */}
              <div className="mt-5 border-t border-dream-line pt-4">
                <Label>Card thumbnail</Label>
                <p className="mb-2 text-xs text-dream-muted">
                  Which colour shows on the Shop All card. We use the on-model photo by default;
                  pick a colour to choose a different model, or switch to the flat photo below.
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-dream-line bg-white">
                    {thumbPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small admin preview of a remote S&S image
                      <img src={thumbPreview} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <div className="h-full w-full bg-dream-lavender-soft" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Select
                      value={thumbColour ?? ""}
                      onChange={(e) => setThumbColour(e.target.value || null)}
                    >
                      <option value="">Auto (most popular colour)</option>
                      {thumbOptions.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Photo style, only relevant once a specific colour is pinned. */}
                {thumbColour && (
                  <div className="mt-3">
                    <div className="inline-flex rounded-lg border border-dream-line p-0.5">
                      {(["model", "flat"] as const).map((v) => {
                        const label = v === "model" ? "On a model" : "Flat photo";
                        const disabled = v === "model" && !thumbHasModel;
                        return (
                          <button
                            key={v}
                            type="button"
                            disabled={disabled}
                            onClick={() => setThumbView(v)}
                            className={cn(
                              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                              thumbView === v
                                ? "bg-dream-lavender-soft text-dream-ink"
                                : "text-dream-muted hover:text-dream-ink",
                              disabled && "cursor-not-allowed opacity-40 hover:text-dream-muted"
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {!thumbHasModel && (
                      <p className="mt-1.5 text-xs text-dream-faint">
                        S&amp;S has no model photo for this colour, so the flat photo is used.
                      </p>
                    )}
                  </div>
                )}
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

          <div id="pe-print-areas" className={cn("scroll-mt-24 rounded-xl transition-shadow", stepRing("pe-print-areas"))}>
            <PrintAreaEditor productId={product.id} initialAreas={printAreas} colours={colours} />
          </div>
        </div>

        {/* Sidebar: pricing, decoration, flags */}
        <div className="space-y-6">
          <Card id="pe-visibility" className={cn("scroll-mt-24 transition-shadow", stepRing("pe-visibility"))}>
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

          {/* Customer pricing: blank (wholesale x markup) + a shared decoration
              profile. The tier table is computed, not hand-typed. */}
          <Card id="pe-pricing" className={cn("scroll-mt-24 transition-shadow", stepRing("pe-pricing"))}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Customer pricing
                <InfoTip text="What customers pay everywhere: shop, product page, designer, order. Built from this product's blank cost plus a shared decoration profile. Change the blank or switch the profile and the whole table re-prices. Edit the tiers themselves in Pricing." />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-dream-bg px-3 py-2 text-sm">
                <span className="flex items-center gap-1 text-dream-muted">
                  Blank cost (S&amp;S)
                  <InfoTip text="What you pay S&S for the blank. Synced from S&S; drives the price gap vs the profile's reference blank." />
                </span>
                <span className="font-semibold text-dream-ink">{formatCAD(product.wholesale_cost ?? 0)}</span>
              </div>

              <Field
                label={
                  <span className="flex items-center gap-1">
                    Markup
                    <InfoTip text="Applied to the blank. It sets the retail of this blank and how much a pricier/cheaper blank shifts the profile's tiers." />
                  </span>
                }
              >
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input type="number" value={markupValue} onChange={(e) => setMarkupValue(e.target.value)} />
                  <Select value={markupType} onChange={(e) => setMarkupType(e.target.value as "percent" | "flat")}>
                    <option value="percent">%</option>
                    <option value="flat">$</option>
                  </Select>
                </div>
              </Field>

              <Field
                label={
                  <span className="flex items-center gap-1">
                    Decoration pricing profile
                    <InfoTip text="The shared quantity-break curve for this kind of product. Every product on the same profile prices consistently; you edit the curve once in Pricing." />
                  </span>
                }
              >
                <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                  <option value="">None (rough blank price only)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {!selectedProfile && (
                <p className="rounded-lg bg-dream-sun-soft px-3 py-2 text-xs font-medium text-dream-ink">
                  No profile selected. Customers see a rough blank-garment price and the designer falls back to
                  cost-plus pricing. Pick a profile above to give it real quantity-break pricing.
                </p>
              )}

              {selectedProfile && previewCurve && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-dream-muted">Resulting price / unit</span>
                    {previewShift !== 0 && (
                      <span className="text-dream-faint">
                        {previewShift > 0 ? "+" : "−"}
                        {formatCAD(Math.abs(previewShift))} vs reference blank
                      </span>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-dream-line">
                    <table className="w-full text-sm tabular-nums">
                      <thead>
                        <tr className="bg-dream-bg text-[11px] uppercase tracking-wide text-dream-muted">
                          <th className="px-3 py-1.5 text-left font-medium">Qty</th>
                          {previewCurve.decorations.map((d) => (
                            <th key={d} className="px-3 py-1.5 text-right font-medium">
                              {DECO_LABEL[d]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PREVIEW_QTYS.map((q) => (
                          <tr key={q} className="border-t border-dream-line">
                            <td className="px-3 py-1.5 text-left text-dream-muted">{q}+</td>
                            {previewCurve.decorations.map((d) => {
                              const breaks = previewCurve.breaks[d] ?? [];
                              return (
                                <td key={d} className="px-3 py-1.5 text-right font-medium text-dream-ink">
                                  {breaks.length ? formatCAD(tierPriceAt(breaks, q)) : "-"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-dream-muted">
                    Computed from the profile&apos;s tiers plus this blank. Extra ink colours and print locations
                    are added on top automatically.{" "}
                    <Link href="/admin/pricing" className="font-medium text-dream-purple hover:underline">
                      Edit tiers in Pricing →
                    </Link>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Cost and margin
                <InfoTip text="Internal numbers. Customers never see these. Use them to sanity-check that your price tiers leave enough margin." />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-dream-bg px-3 py-2 text-sm">
                <div className="flex justify-between text-dream-muted">
                  <span className="flex items-center gap-1">
                    S&amp;S wholesale
                    <InfoTip text="What you pay S&S for the blank garment. Synced from S&S." />
                  </span>
                  <span>{formatCAD(product.wholesale_cost ?? 0)}</span>
                </div>
                <div className="mt-1 flex justify-between font-semibold text-dream-ink">
                  <span className="flex items-center gap-1">
                    Blank retail / unit
                    <InfoTip text="Blank cost times the markup above. This is the 'from' price for a product with no profile; with a profile, customers pay the tier prices." />
                  </span>
                  <span>{formatCAD(retailPreview)}</span>
                </div>
              </div>
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

          <Card>
            <CardHeader>
              <CardTitle>Decoration methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <p className="text-xs text-dream-muted">
                Which techniques customers can pick for this product, on the product page and in the designer.
              </p>
              {methods.map((m) => {
                const visible = methodCustomerVisible(m.slug);
                return (
                  <div key={m.id}>
                    <Checkbox
                      label={m.name}
                      checked={allowed.has(m.id)}
                      onChange={() => setAllowed(toggle(allowed, m.id))}
                    />
                    {allowed.has(m.id) && !visible && (
                      <p className="ml-6 mt-0.5 text-[11px] leading-snug text-dream-muted">
                        {decorationForMethodSlug(m.slug)
                          ? "The selected profile doesn't price this method, so it stays hidden from customers."
                          : "This method has no customer pricing yet, so it stays hidden from customers."}
                      </p>
                    )}
                  </div>
                );
              })}
              {visibleEnabledCount === 0 && (
                <p className="rounded-lg bg-dream-sun/25 px-3 py-2 text-xs font-medium leading-snug text-dream-ink">
                  None of the enabled methods is priced for customers, so no print method will show on
                  the product page or in the designer. Choose a profile that prices at least one enabled method.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
