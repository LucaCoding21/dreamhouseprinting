"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { useToast } from "@/components/ui/use-toast";
import { formatCAD } from "@/lib/money";
import type { PricingProfileWithUsage } from "@/lib/admin/queries";
import type { QuoteDecoration, QuotePriceBreak } from "@/lib/db/rows";
import { updatePricingProfileAction, duplicatePricingProfileAction, deletePricingProfileAction } from "./actions";

const DECO_LABEL: Record<QuoteDecoration, string> = { screen: "Screen print", embroidery: "Embroidery" };

export function PricingClient({ profiles }: { profiles: PricingProfileWithUsage[] }) {
  const router = useRouter();
  return (
    <div>
      <AdminHeader title="Pricing" />
      <div className="mx-auto max-w-3xl space-y-6 px-8 py-6">
        <Card className="border-dream-purple/30 bg-dream-lavender-soft/50">
          <CardContent className="p-5">
            <h2 className="font-display text-base font-semibold text-dream-ink">How pricing works now</h2>
            <p className="mt-1 text-sm text-dream-muted">
              Each product&apos;s customer price is built from two things: its <strong>blank cost</strong> (from
              S&amp;S, set on the product) plus a shared <strong>decoration profile</strong> below. Edit a profile
              once and every product using it re-prices automatically. You never hand-type a product&apos;s table
              again. A profile&apos;s tiers are calibrated for one reference blank; pricier or cheaper blanks shift
              every tier by the exact blank-cost difference.
            </p>
          </CardContent>
        </Card>

        {profiles.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-dream-muted">
              No pricing profiles yet. Run <code>scripts/seed-pricing-profiles.mjs</code> to create the starter set.
            </CardContent>
          </Card>
        )}

        {profiles.map((p) => (
          <ProfileCard key={p.profile.id} data={p} onChanged={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}

type Rows = Record<string, { minQty: string; price: string }[]>;

function ProfileCard({ data, onChanged }: { data: PricingProfileWithUsage; onChanged: () => void }) {
  const { toast } = useToast();
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const profile = data.profile;
  const decorations = (profile.decorations ?? []) as QuoteDecoration[];

  const [name, setName] = useState(profile.name);
  const [setup, setSetup] = useState<Record<string, string>>(() => {
    const s = (profile.setup ?? {}) as Partial<Record<QuoteDecoration, number>>;
    const out: Record<string, string> = {};
    for (const d of decorations) out[d] = s[d] != null ? String(s[d]) : "";
    return out;
  });
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
      const setupOut: Record<string, number> = {};
      for (const d of decorations) {
        tiers[d] = (rows[d] ?? []).map((r) => ({ minQty: Number(r.minQty) || 0, price: Number(r.price) || 0 }));
        const s = Number(setup[d]);
        if (Number.isFinite(s) && s > 0) setupOut[d] = s;
      }
      const res = await updatePricingProfileAction(profile.id, {
        name,
        decorations,
        setup: setupOut,
        tiers,
      });
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
          <span className="font-semibold text-dream-ink">{profile.ref_wholesale != null ? formatCAD(profile.ref_wholesale) : "—"}</span>
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
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-dream-muted">
                  <span className="flex items-center gap-1">
                    Min qty
                    <InfoTip text="This row's price applies from this quantity up to the next row." />
                  </span>
                  <span>$ / unit (all-in)</span>
                  <span className="w-7" />
                </div>
                {(rows[d] ?? []).map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                    <Input type="number" min={1} value={r.minQty} onChange={(e) => setRow(d, i, "minQty", e.target.value)} />
                    <Input type="number" min={0} step="0.01" value={r.price} onChange={(e) => setRow(d, i, "price", e.target.value)} />
                    <button
                      type="button"
                      aria-label="Remove tier"
                      onClick={() => removeRow(d, i)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-dream-muted hover:bg-dream-bg hover:text-dream-ink"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div>
                  <Button variant="ghost" size="sm" onClick={() => addRow(d)}>
                    + Add tier
                  </Button>
                </div>
              </div>
              <Field
                label={
                  <span className="flex items-center gap-1">
                    Setup fee
                    <InfoTip text="One-time cost for this method (digitizing an embroidery file, burning screens). It's already included in the tier prices today; it's stored separately so invoices can show it as its own line later." />
                  </span>
                }
              >
                <div className="flex items-center gap-1">
                  <span className="text-sm text-dream-muted">$</span>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    className="w-24"
                    value={setup[d] ?? ""}
                    onChange={(e) => setSetup((prev) => ({ ...prev, [d]: e.target.value }))}
                  />
                </div>
              </Field>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
