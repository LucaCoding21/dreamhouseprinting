"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderListRow, OrderListHeader } from "@/components/portal/OrderRow";
import type { OrderRow, OrderStatus } from "@/lib/db/rows";

// Customer-facing filter buckets. Colour-free labels grouped by where the order
// sits in its journey, narrower than the 13 raw statuses so the menu stays short.
type FilterKey = "all" | "action" | "active" | "delivered";

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: "all", label: "All orders" },
  { value: "action", label: "Needs your approval" },
  { value: "active", label: "In progress" },
  { value: "delivered", label: "Shipped & completed" },
];

function orderGroup(status: OrderStatus): FilterKey | null {
  switch (status) {
    case "proof_ready":
    case "changes_requested":
      return "action";
    case "submitted":
    case "in_review":
    case "approved":
    case "in_production":
    case "quality_check":
    case "on_hold":
      return "active";
    case "shipped":
    case "ready_for_pickup":
    case "completed":
      return "delivered";
    default:
      return null; // draft / cancelled, not surfaced in the filters
  }
}

export function OrdersList({ orders }: { orders: OrderRow[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const visible = useMemo(
    () =>
      filter === "all"
        ? orders
        : orders.filter((o) => orderGroup(o.status as OrderStatus) === filter),
    [orders, filter],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-dream-ink">My orders</h1>
          <p className="mt-1 text-dream-muted">
            {orders.length > 0
              ? `${orders.length} order${orders.length === 1 ? "" : "s"}, newest first.`
              : "Everything you order shows up here."}
          </p>
        </div>
        {orders.length > 0 && (
          <div className="w-full sm:w-56">
            <Select
              aria-label="Filter orders by status"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterKey)}
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={orders.length === 0 ? "No orders yet" : "No orders match that filter"}
          description={
            orders.length === 0
              ? "Design something and place your first order."
              : "Try a different status filter."
          }
          action={
            orders.length === 0 ? (
              <Link href="/shop">
                <Button variant="primary">Start a design</Button>
              </Link>
            ) : (
              <Button variant="secondary" onClick={() => setFilter("all")}>
                Clear filter
              </Button>
            )
          }
        />
      ) : (
        <div>
          <OrderListHeader />
          <div className="space-y-2.5">
            {visible.map((o) => (
              <OrderListRow key={o.id} o={o} columns />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
