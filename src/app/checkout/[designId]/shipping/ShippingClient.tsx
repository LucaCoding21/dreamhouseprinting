"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { cn } from "@/lib/cn";
import type { ProvinceCode } from "@/lib/pricing/tax";
import type { CheckoutSettings } from "@/lib/checkoutSettings";
import { OrderSummary, type CheckoutSummary } from "../OrderSummary";
import { CheckoutHeader } from "../CheckoutClient";

type Fulfillment = "ship" | "pickup";
type Turnaround = "standard" | "rush";

export function ShippingClient({
  designId,
  summary,
  province,
  checkout,
}: {
  designId: string;
  summary: CheckoutSummary;
  province: ProvinceCode | null;
  checkout: CheckoutSettings;
}) {
  const router = useRouter();
  const [fulfillment, setFulfillment] = useState<Fulfillment>("ship");
  const [turnaround, setTurnaround] = useState<Turnaround>("standard");
  const [busy, setBusy] = useState(false);

  function goToReview() {
    setBusy(true);
    router.push(`/checkout/${designId}/review?fulfillment=${fulfillment}&turnaround=${turnaround}`);
  }

  return (
    <div className="min-h-screen bg-dream-bg text-dream-ink">
      <SiteNav />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <CheckoutHeader current={1} backHref={`/checkout/${designId}`} backLabel="Back to contact" />

        <div className="flex flex-col-reverse gap-8 lg:flex-row lg:items-start">
          {/* Left — delivery + timeline */}
          <div className="flex-1">
            <section className="rounded-2xl border border-dream-line bg-white p-6">
              <h2 className="font-display text-lg font-bold">Delivery</h2>
              <p className="mt-1 text-sm text-dream-muted">{checkout.shippingNote}</p>
              <div className={cn("mt-4 grid grid-cols-1 gap-3", checkout.pickupEnabled && "sm:grid-cols-2")}>
                <OptionCard
                  selected={fulfillment === "ship"}
                  onSelect={() => setFulfillment("ship")}
                  title="Ship to me"
                  subtitle="Free standard shipping"
                  badge="Free"
                />
                {checkout.pickupEnabled && (
                  <OptionCard
                    selected={fulfillment === "pickup"}
                    onSelect={() => setFulfillment("pickup")}
                    title="Pick up"
                    subtitle={checkout.pickupNote}
                    badge="Free"
                  />
                )}
              </div>
            </section>

            {checkout.rushEnabled && (
              <section className="mt-6 rounded-2xl border border-dream-line bg-white p-6">
                <h2 className="font-display text-lg font-bold">
                  How soon do you need it? <span className="text-sm font-medium text-dream-faint">(optional)</span>
                </h2>
                <p className="mt-1 text-sm text-dream-muted">{checkout.timelineNote}</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <OptionCard
                    selected={turnaround === "standard"}
                    onSelect={() => setTurnaround("standard")}
                    title="Standard"
                    subtitle={checkout.standardNote}
                    badge="Free"
                  />
                  <OptionCard
                    selected={turnaround === "rush"}
                    onSelect={() => setTurnaround("rush")}
                    title="ASAP / rush"
                    subtitle={checkout.rushNote}
                    badge="+50%"
                    badgeTone="fee"
                  />
                </div>
              </section>
            )}

            <button
              onClick={goToReview}
              disabled={busy}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-dream-purple px-6 py-3.5 font-display text-base font-bold text-white shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition-transform active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-10"
            >
              {busy ? "Loading…" : "Continue to review"}
            </button>
            <p className="mt-3 text-xs text-dream-faint">{checkout.footnote}</p>
          </div>

          {/* Right — order summary */}
          <aside className="w-full lg:w-[360px] lg:shrink-0">
            <OrderSummary summary={summary} province={province} shippingLabel="Free" rush={turnaround === "rush"} />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  subtitle,
  badge,
  badgeTone = "free",
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  badge?: string;
  /** "free" = green (no charge), "fee" = purple (surcharge). */
  badgeTone?: "free" | "fee";
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
        selected ? "border-dream-purple bg-dream-lavender-soft" : "border-dream-line bg-white hover:border-dream-line-strong"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-dream-purple" : "border-dream-line-strong"
        )}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-dream-purple" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-display text-sm font-bold text-dream-ink">{title}</span>
          {badge && (
            <span
              className={cn(
                "shrink-0 text-xs font-bold uppercase tracking-wide",
                badgeTone === "fee" ? "text-dream-purple" : "text-dream-success"
              )}
            >
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-dream-muted">{subtitle}</span>
      </span>
    </button>
  );
}
