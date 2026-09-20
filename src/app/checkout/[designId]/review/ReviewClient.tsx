"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { calcTax, provinceName, isProvinceCode } from "@/lib/pricing/tax";
import { CheckoutHeader } from "../CheckoutClient";
import { placeOrderAction } from "../actions";
import type { ReviewContext } from "../context";

type Milestone = { icon: string; label: string; detail: string };

export function ReviewClient({
  ctx,
  fulfillment,
  turnaround,
  neededBy,
  timeline,
}: {
  ctx: ReviewContext;
  fulfillment: "ship" | "pickup";
  turnaround: "standard" | "rush";
  neededBy: string | null;
  timeline: Milestone[];
}) {
  const router = useRouter();
  const { summary, contact, province, designId } = ctx;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const provLabel = isProvinceCode(contact.province) ? provinceName(contact.province) : contact.province;
  const addressLines = [contact.street, `${contact.city}, ${contact.province} ${contact.postal}`.trim(), "Canada"];

  // Rush is a request, not a fixed surcharge, the shop quotes the fee when they
  // confirm the order, so it never lands in this estimate.
  const isRush = turnaround === "rush";
  const tax = calcTax(summary.subtotal + summary.setup, province);
  const shipping = 0;
  const total = summary.subtotal + summary.setup + shipping + tax.total;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await placeOrderAction({ designId, fulfillment, turnaround, neededBy });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.orderId) {
        // The public order page renders for guests and signed-in customers
        // alike, so both land straight on the order they just submitted.
        if (res.publicToken) {
          router.push(`/o/${res.publicToken}`);
        } else if (res.isGuest) {
          router.push(`/checkout/done?order=${encodeURIComponent(res.orderNumber ?? "")}`);
        } else {
          router.push(`/account/orders/${res.orderId}?placed=1`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-dream-bg text-dream-ink">
      <SiteNav />

      <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-8 sm:px-6 sm:pb-44">
        <CheckoutHeader current={2} backHref={`/checkout/${designId}/shipping`} backLabel="Back to shipping" />
        <h2 className="mb-5 font-display text-xl font-bold">Order review</h2>

        {/* Contact / addresses + money summary */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-4">
            <InfoCard title="Contact information">
              <p className="font-medium text-dream-ink">{fullName || "-"}</p>
              {contact.phone && <p>{contact.phone}</p>}
              {contact.email && <p>{contact.email}</p>}
              {contact.company && <p className="text-dream-muted">{contact.company}</p>}
            </InfoCard>

            <InfoCard title={fulfillment === "pickup" ? "Pickup" : "Shipping address"}>
              {fulfillment === "pickup" ? (
                <p>Pick up at our shop, we’ll email you when it’s ready.</p>
              ) : (
                <>
                  <p className="font-medium text-dream-ink">{fullName || "-"}</p>
                  {addressLines.filter(Boolean).map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                  {contact.phone && <p>{contact.phone}</p>}
                </>
              )}
            </InfoCard>

            <InfoCard title="Billing address">
              <p className="font-medium text-dream-ink">{fullName || "-"}</p>
              {addressLines.filter(Boolean).map((l, i) => (
                <p key={i}>{l}</p>
              ))}
              {provLabel && <p className="text-dream-faint">{provLabel}</p>}
            </InfoCard>
          </div>

          {/* Money summary */}
          <div className="rounded-2xl border border-dream-line bg-white p-6 lg:sticky lg:top-24">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-dream-muted">Summary</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <MoneyRow label="Cart subtotal" value={formatCAD(summary.subtotal)} />
              {summary.setup > 0 && <MoneyRow label="Setup fees" value={formatCAD(summary.setup)} />}
              {isRush && <MoneyRow label="Rush requested" value="Fee quoted on your proof" muted />}
              {isRush && neededBy && <MoneyRow label="Need it by" value={fmtNeededBy(neededBy)} muted />}
              <MoneyRow label="Shipping" value={formatCAD(shipping)} />
              {tax.lines.map((l) => (
                <MoneyRow key={l.label} label={l.label} value={formatCAD(l.amount)} />
              ))}
              <div className="border-t border-dream-line pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-base font-bold">Order total</span>
                  <span>
                    <span className="font-display text-xl font-extrabold text-dream-purple">{formatCAD(total)}</span>
                    <span className="ml-1 text-[14px] text-dream-faint">CAD</span>
                  </span>
                </div>
              </div>
            </dl>
          </div>
        </div>

        {/* Projected timeline */}
        <section className="mt-8 rounded-2xl border border-dream-line bg-white p-6">
          <div className="flex flex-col gap-8 sm:flex-row">
            {timeline.map((t, i) => (
              <div key={i} className="relative flex flex-1 flex-col items-center text-center">
                {i < timeline.length - 1 && (
                  <span className="absolute left-1/2 top-5 hidden h-px w-full bg-dream-line sm:block" />
                )}
                <span
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full",
                    i === 0 ? "bg-dream-purple text-white" : "border border-dream-line bg-dream-lavender-soft text-dream-purple"
                  )}
                >
                  <TimelineIcon name={t.icon} />
                </span>
                <p className="mt-2 font-display text-sm font-bold leading-tight">{t.label}</p>
                <p className="mt-0.5 text-[14px] text-dream-muted">{t.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Line item detail */}
        <section className="mt-6 rounded-2xl border border-dream-line bg-white p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="relative h-52 w-full shrink-0 overflow-hidden rounded-xl bg-white sm:h-44 sm:w-44">
              {summary.mockupUrl ? (
                <Image src={summary.mockupUrl} alt={summary.designName} fill className="object-contain" sizes="(max-width: 640px) 100vw, 176px" unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center text-dream-faint">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-12 w-12" aria-hidden>
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="8.5" cy="9.5" r="1.5" />
                    <path d="M4 16l4.5-4 3.5 3 3-3 5 5" />
                  </svg>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold">
                  1. {summary.productName}
                  {summary.brand && <span className="ml-2 text-sm font-medium text-dream-muted">{summary.brand}</span>}
                </h3>
                <div className="text-right">
                  <div className="inline-block rounded-lg bg-dream-lavender-soft px-2.5 py-1 font-display font-extrabold text-dream-purple">
                    {formatCAD(summary.subtotal)} CAD
                  </div>
                  <div className="mt-1 text-[14px] text-dream-muted">
                    {summary.quantity} {summary.quantity === 1 ? "item" : "items"}
                    {summary.colorways.length > 1 ? ` · ${summary.colorways.length} colours` : ""}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[14px] font-bold uppercase tracking-wide text-dream-muted">Colours &amp; sizes</p>
              <div className="mt-2 space-y-2">
                {summary.colorways.map((cw, i) => (
                  <div key={i} className="rounded-xl border border-dream-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-dream-ink">
                        {cw.colourHex && (
                          <span className="h-3.5 w-3.5 rounded-full border border-dream-line" style={{ backgroundColor: cw.colourHex }} />
                        )}
                        {cw.colourName ?? "-"}
                      </span>
                      <span className="text-[14px] text-dream-muted">
                        {cw.quantity} @ {formatCAD(cw.unitPrice)} ={" "}
                        <span className="font-bold text-dream-ink">{formatCAD(cw.lineTotal)} CAD</span>
                      </span>
                    </div>
                    {cw.sizeBreakdown.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {cw.sizeBreakdown.map((s) => (
                          <span key={s.size} className="rounded-full bg-dream-bg px-2.5 py-1 text-[14px] font-medium">
                            {s.size} ({s.qty})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p className="mt-5 text-[14px] font-bold uppercase tracking-wide text-dream-muted">Decoration</p>
              <div className="mt-2 overflow-hidden rounded-xl border border-dream-line">
                <table className="w-full text-sm">
                  <thead className="bg-dream-bg text-left text-[14px] uppercase tracking-wide text-dream-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Location</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Colour(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctx.printLocations.map((loc, i) => (
                      <tr key={i} className="border-t border-dream-line">
                        <td className="px-3 py-2">
                          <span className="rounded-md bg-dream-bg px-2 py-0.5 text-[14px] font-medium">{loc}</span>
                        </td>
                        <td className="px-3 py-2">{ctx.decorationMethodName ?? "-"}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-md bg-dream-lavender-soft px-2 py-0.5 text-[14px] font-medium text-dream-purple">
                            Full colour
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {error && <p className="mt-6 rounded-xl bg-dream-danger-soft px-4 py-3 text-sm text-dream-danger">{error}</p>}

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col gap-3 border-t border-dream-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/checkout/${designId}/shipping`}
            className="inline-flex items-center justify-center rounded-full border border-dream-line bg-white px-5 py-3 font-display text-sm font-bold text-dream-ink transition-colors hover:bg-dream-cream"
          >
            ← Shipping
          </Link>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
            <span className="text-center text-[14px] text-dream-faint">Payment is made after expert review.</span>
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-full bg-dream-purple px-10 py-3.5 font-display text-base font-bold text-white shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition-transform active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit order"}
            </button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Render a YYYY-MM-DD need-by date as a friendly local-day label. */
function fmtNeededBy(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TimelineIcon({ name }: { name: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true,
  };
  switch (name) {
    case "created":
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4h6v2.5H9zM8.5 11h7M8.5 15h4.5" />
        </svg>
      );
    case "mockup":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.4" />
          <path d="M5 16.5l4-3.5 3 2.5 3-3 4 4" />
        </svg>
      );
    case "printing":
      return (
        <svg {...common}>
          <path d="M7 9V4h10v5" />
          <rect x="4" y="9" width="16" height="7" rx="2" />
          <rect x="7" y="14" width="10" height="6" rx="1" />
          <path d="M16.5 12h.01" />
        </svg>
      );
    case "ship":
      return (
        <svg {...common}>
          <path d="M3 7.5h11v8.5H3z" />
          <path d="M14 10.5h3.5L21 14v2h-7z" />
          <circle cx="7" cy="17.5" r="1.6" />
          <circle cx="17.5" cy="17.5" r="1.6" />
        </svg>
      );
    case "store":
      return (
        <svg {...common}>
          <path d="M4 10v9h16v-9" />
          <path d="M3 6h18l-1.2 4H4.2z" />
          <path d="M10 19v-4h4v4" />
        </svg>
      );
    case "box":
    default:
      return (
        <svg {...common}>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
          <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
        </svg>
      );
  }
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dream-line bg-white p-5">
      <h3 className="text-[14px] font-bold uppercase tracking-wide text-dream-muted">{title}</h3>
      <div className="mt-2 space-y-0.5 text-sm text-dream-muted">{children}</div>
    </div>
  );
}

function MoneyRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-dream-muted">{label}</dt>
      <dd className={muted ? "text-dream-faint" : "font-medium text-dream-ink"}>
        {value}
        {!muted && <span className="text-[14px] text-dream-faint"> CAD</span>}
      </dd>
    </div>
  );
}
