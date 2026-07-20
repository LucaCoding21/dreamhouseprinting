"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { CommandHeader } from "./CommandHeader";
import { OrderTimeline } from "./OrderTimeline";
import { OrderItemsSection } from "./OrderItemsSection";
import { ProofHistory } from "./ProofHistory";
import { OrderStatusStrip } from "./OrderStatusStrip";
import { PricingCard } from "./PricingCard";
import { CustomerCard } from "./CustomerCard";
import { OrderReference } from "./OrderReference";
import { fmtWhen, relativeTime, type Can, type Detail, type StoredAddress } from "./shared";

export function OrderDetailClient({
  detail,
  methodNames,
  can,
}: {
  detail: Detail;
  methodNames: Record<string, string>;
  can: Can;
}) {
  const { order, customer } = detail;
  const ship = (order.shipping_address ?? {}) as StoredAddress;
  const who = ship.company || customer?.name || ship.name || customer?.email || order.guest_email || "Guest";

  const pieces = detail.lineItems.reduce((acc, li) => {
    const sq = (li.size_quantities ?? {}) as Record<string, number>;
    return acc + Object.values(sq).reduce((a, b) => a + (Number(b) > 0 ? Number(b) : 0), 0);
  }, 0);

  return (
    <div className="space-y-6 px-8 py-6">
      {/* Slim command strip, identity + the one hero action, always up top */}
      <CommandHeader detail={detail} can={can} who={who} />

      {/* The lines, the hero of the screen, full width */}
      <OrderItemsSection detail={detail} methodNames={methodNames} can={can} />

      {/* Active-work context that lives alongside the lines */}
      <ProofHistory detail={detail} />
      <OrderTimeline order={order} orderId={order.id} canEdit={can.edit} />

      {/* ── Reference: status, contact, payment, totals, one-time info, kept at the bottom ── */}
      <section className="space-y-6 border-t border-dream-line pt-8">
        <OrderStatusStrip detail={detail} />

        <div className="grid items-start gap-6 lg:grid-cols-3">
          <CustomerCard detail={detail} canEdit={can.edit} />
          <OrderReference detail={detail} can={can} pieces={pieces} />
          {/* Remount when the stored pricing changes (e.g. after an item edit
              recomputes tax) so the card can't overwrite it with stale local state. */}
          <PricingCard key={JSON.stringify(order.pricing)} detail={detail} can={can} />
        </div>

        {detail.activity.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold text-dream-muted transition-colors hover:text-dream-ink">
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden>
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Activity log ({detail.activity.length})
              </span>
            </summary>
            <Card className="mt-3">
              <CardContent className="divide-y divide-dream-line p-5">
                {detail.activity.map((a) => (
                  <div key={a.id} className="flex items-baseline justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0 truncate">
                      <span className="font-semibold capitalize text-dream-ink">{a.type.replace(/_/g, " ")}</span>
                      <span className="text-dream-muted"> · {a.actor_name ?? "Staff"}</span>
                    </div>
                    <time dateTime={a.created_at} title={fmtWhen(a.created_at)} className="shrink-0 text-xs text-dream-faint">
                      {relativeTime(a.created_at)}
                    </time>
                  </div>
                ))}
              </CardContent>
            </Card>
          </details>
        )}
      </section>
    </div>
  );
}
