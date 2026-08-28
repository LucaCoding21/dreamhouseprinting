"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/use-toast";
import { formatCAD } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { PricingProfileWithUsage } from "@/lib/admin/queries";
import type { QuoteDecoration, QuotePriceBreak } from "@/lib/db/rows";
import { updatePricingProfileAction, duplicatePricingProfileAction, deletePricingProfileAction } from "./actions";
import { DecorationChargesTab, AddonsTab } from "./DecorationChargesTab";
import type { DecorationPricingSettings } from "@/lib/pricing/decorationPricing";
import type { AddonSettings } from "@/lib/addonSettings";

const DECO_LABEL: Record<QuoteDecoration, string> = { screen: "Screen print", embroidery: "Embroidery" };

/**
 * Every number that moves a customer's price, on one screen. Price lists set
 * the base; decoration charges and rush adjust it; add-ons are per-garment
 * extras. These used to be split across this page and two Settings tabs, so
 * "what does this cost" had three possible homes.
 */
export function PricingClient({
  profiles,
  decorationPricing,
  addons,
}: {
  profiles: PricingProfileWithUsage[];
  decorationPricing: DecorationPricingSettings;
  addons: AddonSettings;
}) {
  const router = useRouter();
  return (
    <div>
      <AdminHeader title="Pricing" />
      <div className="px-4 py-6 sm:px-8">
        <Tabs defaultValue="lists">
          <TabsList>
            <TabsTrigger value="lists">Price lists</TabsTrigger>
            <TabsTrigger value="decoration">Decoration &amp; rush</TabsTrigger>
            <TabsTrigger value="addons">Add-ons</TabsTrigger>
          </TabsList>

          <TabsContent value="lists" className="mt-4">
            <div className="space-y-6">
              <Card className="mx-auto max-w-3xl border-dream-purple/30 bg-dream-lavender-soft/50">
                <CardContent className="p-5">
                  <h2 className="font-display text-base font-semibold text-dream-ink">How pricing works</h2>
                  <p className="mt-1 text-sm text-dream-muted">
                    A product&apos;s price is its <strong>blank cost</strong> (from S&amp;S, set on the product) plus
                    a shared <strong>price list</strong> below. Edit a list once and every product using it re-prices
                    automatically. The tiers are all-inclusive, the way you quote: screen setup is already collected
                    in the low-quantity rows, which is why one shirt costs far more than each of fifty. A list is
                    calibrated for one reference blank, and pricier or cheaper blanks shift every tier by the exact
                    blank-cost difference.
                  </p>
                </CardContent>
              </Card>

              {profiles.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-sm text-dream-muted">
                    No price lists yet. Run <code>scripts/seed-pricing-profiles.mjs</code> to create the starter set.
                  </CardContent>
                </Card>
              ) : (
                <PriceLists profiles={profiles} onChanged={() => router.refresh()} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="decoration" className="mt-4">
            <DecorationChargesTab settings={decorationPricing} />
          </TabsContent>

          <TabsContent value="addons" className="mt-4">
            <AddonsTab settings={addons} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/**
 * Master/detail instead of a stack. Six lists x two decorations x ~24 tiers is
 * roughly 250 inputs in one column, so finding the list you wanted meant
 * scrolling past every other one. Pick on the left, edit on the right.
 */
function PriceLists({
  profiles,
  onChanged,
}: {
  profiles: PricingProfileWithUsage[];
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.profile.id ?? null);
  const selected = profiles.find((p) => p.profile.id === selectedId) ?? profiles[0];

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Below lg the master list would stack as ~6 rows to scroll past on the
          way to the editor every time, so the picker collapses to a select. */}
      <Field label="Price list" className="lg:hidden">
        <Select value={selected?.profile.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
          {profiles.map((p) => (
            <option key={p.profile.id} value={p.profile.id}>
              {p.profile.name} ({p.productCount})
            </option>
          ))}
        </Select>
      </Field>

      <nav aria-label="Price lists" className="hidden shrink-0 space-y-1 lg:block lg:w-64">
        {profiles.map((p) => {
          const on = p.profile.id === selected?.profile.id;
          const span = tierSpan(p);
          return (
            <button
              key={p.profile.id}
              type="button"
              onClick={() => setSelectedId(p.profile.id)}
              aria-current={on}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                on
                  ? "border-dream-purple bg-dream-lavender-soft"
                  : "border-dream-line bg-white hover:border-dream-purple/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-dream-ink">{p.profile.name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    p.productCount > 0 ? "bg-dream-success-soft text-dream-success" : "bg-dream-line text-dream-muted",
                  )}
                >
                  {p.productCount}
                </span>
              </div>
              {/* The range answers "is this the cheap list or the dear one?"
                  without opening it. */}
              {span && (
                <div className="mt-0.5 text-[11px] text-dream-muted">
                  {formatCAD(span.high)} at 1 to {formatCAD(span.low)} at {span.lowQty}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* key: remount on switch so the editor's draft state never leaks across lists */}
      <div className="min-w-0 flex-1">
        {selected && <ProfileCard key={selected.profile.id} data={selected} onChanged={onChanged} />}
      </div>
    </div>
  );
}

/** Cheapest and dearest tier across a list's decorations, for the summary line. */
function tierSpan(p: PricingProfileWithUsage): { high: number; low: number; lowQty: number } | null {
  const tiers = (p.profile.tiers ?? {}) as Partial<Record<QuoteDecoration, QuotePriceBreak[]>>;
  const all = Object.values(tiers).flatMap((t) => t ?? []);
  if (all.length === 0) return null;
  const high = Math.max(...all.map((t) => t.price));
  const cheapest = all.reduce((a, b) => (b.price < a.price ? b : a));
  return { high, low: cheapest.price, lowQty: cheapest.minQty };
}

type Rows = Record<string, { minQty: string; price: string }[]>;

function ProfileCard({ data, onChanged }: { data: PricingProfileWithUsage; onChanged: () => void }) {
  const { toast } = useToast();
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const profile = data.profile;
  const decorations = (profile.decorations ?? []) as QuoteDecoration[];

  const [name, setName] = useState(profile.name);
  const [rows, setRows] = useState<Rows>(() => {
    const tiers = (profile.tiers ?? {}) as Partial<Record<QuoteDecoration, QuotePriceBreak[]>>;
    const out: Rows = {};
    for (const d of decorations) out[d] = (tiers[d] ?? []).map((t) => ({ minQty: String(t.minQty), price: String(t.price) }));
    return out;
  });

  function setRow(d: string, i: number, field: "minQty" | "price", v: string) {
    setRows((prev) => ({ ...prev, [d]: prev[d].map((r, idx) => (idx === i ? { ...r, [field]: v } : r)) }));
  }
  function addRow(d: string) {
    setRows((prev) => ({ ...prev, [d]: [...(prev[d] ?? []), { minQty: "", price: "" }] }));
  }
  function removeRow(d: string, i: number) {
    setRows((prev) => ({ ...prev, [d]: prev[d].filter((_, idx) => idx !== i) }));
  }

  function save() {
    startSave(async () => {
      const tiers: Record<string, { minQty: number; price: number }[]> = {};
      for (const d of decorations) {
        tiers[d] = (rows[d] ?? []).map((r) => ({ minQty: Number(r.minQty) || 0, price: Number(r.price) || 0 }));
      }
      const res = await updatePricingProfileAction(profile.id, { name, decorations, tiers });
      if (res.error) toast({ title: "Save failed", description: res.error, variant: "error" });
      else {
        toast({
          title: "Profile saved",
          description: res.recompiled ? `Re-priced ${res.recompiled} product${res.recompiled === 1 ? "" : "s"}.` : undefined,
          variant: "success",
        });
        onChanged();
      }
    });
  }

  function duplicate() {
    startBusy(async () => {
      const res = await duplicatePricingProfileAction(profile.id);
      if (res.error) toast({ title: "Couldn't duplicate", description: res.error, variant: "error" });
      else {
        toast({ title: "Profile duplicated", variant: "success" });
        onChanged();
      }
    });
  }

  function remove() {
    startBusy(async () => {
      const res = await deletePricingProfileAction(profile.id);
      if (res.error) toast({ title: "Couldn't delete", description: res.error, variant: "error" });
      else {
        toast({ title: "Profile deleted", variant: "success" });
        onChanged();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            {profile.name}
            <Badge variant={data.productCount > 0 ? "success" : "neutral"}>
              {data.productCount} product{data.productCount === 1 ? "" : "s"}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={duplicate} loading={busy} disabled={saving}>
              Duplicate
            </Button>
            {data.productCount === 0 && (
              <Button variant="ghost" size="sm" onClick={remove} loading={busy} disabled={saving}>
                Delete
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={save} loading={saving}>
              Save profile
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field label="Profile name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="flex items-center justify-between rounded-lg bg-dream-bg px-3 py-2 text-sm text-dream-muted">
          <span className="flex items-center gap-1">
            Reference blank cost
            <InfoTip text="The blank wholesale these tiers are calibrated for. A product with a pricier blank pays these prices plus the difference; a cheaper blank pays less. Set on the reference product, not here." />
          </span>
          <span className="font-semibold text-dream-ink">{profile.ref_wholesale != null ? formatCAD(profile.ref_wholesale) : "-"}</span>
        </div>

        {data.productCount > 0 && (
          <p className="rounded-lg bg-dream-sun-soft px-3 py-2 text-xs font-medium text-dream-ink">
            Saving reflows all {data.productCount} product{data.productCount === 1 ? "" : "s"} on this profile.
          </p>
        )}

        {decorations.map((d) => (
          <div key={d} className="border-t border-dream-line pt-4">
            <Label>{DECO_LABEL[d]}</Label>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-3">
              <div className="grid gap-1.5">
                <div className="flex items-center gap-1 px-1 text-[11px] font-medium uppercase tracking-wide text-dream-muted">
                  Min qty, then $ / unit (all-in)
                  <InfoTip text="Each row's price applies from its quantity up to the next row. Read them down each column." />
                </div>
                {/* CSS columns, not a grid: rows keep reading top-to-bottom in
                    ascending quantity, they just wrap into a second column. */}
                <div className="columns-1 gap-x-6 xl:columns-2 min-[1780px]:columns-3">
                {(rows[d] ?? []).map((r, i) => (
                  <div key={i} className="mb-1.5 grid break-inside-avoid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                    <Input type="number" min={1} value={r.minQty} onChange={(e) => setRow(d, i, "minQty", e.target.value)} />
                    <Input type="number" min={0} step="0.01" value={r.price} onChange={(e) => setRow(d, i, "price", e.target.value)} />
                    <button
                      type="button"
                      aria-label="Remove tier"
                      onClick={() => removeRow(d, i)}
                      // ::before lifts the tap target to 32px without resizing
                      // the 28px hover chip.
                      className="relative flex h-7 w-7 items-center justify-center rounded-md text-dream-muted before:absolute before:-inset-0.5 before:content-[''] hover:bg-dream-bg hover:text-dream-ink"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                </div>
                <div>
                  {/* Button size sm is already h-8, so the tap target clears 32px. */}
                  <Button variant="ghost" size="sm" onClick={() => addRow(d)}>
                    + Add tier
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
