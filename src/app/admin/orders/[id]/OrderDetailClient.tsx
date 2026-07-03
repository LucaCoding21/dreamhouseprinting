"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { STATUS_META } from "@/lib/orderStatus";
import { OrderTimeline } from "./OrderTimeline";
import { OrderContactCards } from "./OrderContactCards";
import { OrderItemsSection } from "./OrderItemsSection";
import { ProductionNotes } from "./ProductionNotes";
import { OrderRail } from "./OrderRail";
import { fmtDay, fmtWhen, relativeTime, type Can, type Detail, type StoredAddress } from "./shared";
import type { OrderStatus } from "@/lib/db/rows";

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
  const meta = STATUS_META[order.status as OrderStatus];
  const ship = (order.shipping_address ?? {}) as StoredAddress;
  const who = ship.company || customer?.name || ship.name || customer?.email || order.guest_email || "Guest";

  const pieces = detail.lineItems.reduce((acc, li) => {
    const sq = (li.size_quantities ?? {}) as Record<string, number>;
    return acc + Object.values(sq).reduce((a, b) => a + (Number(b) > 0 ? Number(b) : 0), 0);
  }, 0);

  return (
    <div className="space-y-6 px-8 py-6">
      {/* Header */}
      <div>
        <Link href="/admin/orders" className="text-sm text-dream-purple hover:underline">
          Back to orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold text-dream-ink">Order {order.order_number ?? ""}</h1>
          <Badge variant={meta?.badge ?? "neutral"}>{meta?.label ?? order.status}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dream-muted">
          <span>{who}</span>
          <span aria-hidden>·</span>
          <span>Created {fmtDay(order.created_at)}</span>
          {order.due_date && (
            <>
              <span aria-hidden>·</span>
              <span>Due {fmtDay(order.due_date)}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>Updated {fmtWhen(order.updated_at)}</span>
        </div>
      </div>

      {order.hold_note && (
        <div className="rounded-lg border border-dream-warn/40 bg-dream-warn-soft px-4 py-3 text-sm text-dream-warn">
          <strong>On hold:</strong> {order.hold_note}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main scrolling column */}
        <div className="min-w-0 space-y-6">
          <OrderTimeline order={order} orderId={order.id} canEdit={can.edit} />
          <OrderContactCards detail={detail} canEdit={can.edit} />
          <OrderItemsSection detail={detail} methodNames={methodNames} can={can} />
          <ProductionNotes order={order} canEdit={can.edit} />

          {detail.activity.length > 0 && (
            <Card>
              <CardContent className="divide-y divide-dream-line p-5">
                <div className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-dream-muted">Activity log</div>
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
          )}
        </div>

        {/* Sticky right rail */}
        <OrderRail detail={detail} can={can} pieces={pieces} />
      </div>
    </div>
  );
}
