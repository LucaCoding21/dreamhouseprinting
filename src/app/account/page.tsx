import Link from "next/link";
import Image from "next/image";
import { getProfile } from "@/lib/auth";
import { getMyOrders } from "@/lib/db/orders";
import { Button } from "@/components/ui/Button";
import { formatCAD } from "@/lib/money";
import { OrderListRow } from "@/components/portal/OrderRow";
import { IconChevronRight, IconArrowRight } from "@/components/portal/icons";
import type { OrderRow, OrderStatus } from "@/lib/db/rows";

const ACTIVE_STATUSES: OrderStatus[] = [
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "in_production",
  "quality_check",
  "shipped",
  "ready_for_pickup",
  "on_hold",
];

const APPROVED_STATUSES: OrderStatus[] = [
  "approved",
  "in_production",
  "quality_check",
  "shipped",
  "ready_for_pickup",
  "completed",
];

const MAX_IN_PROGRESS = 6;

function orderTotal(o: OrderRow): number {
  return ((o.pricing ?? {}) as { total?: number }).total ?? 0;
}

export default async function AccountDashboardPage() {
  const [profile, orders] = await Promise.all([getProfile(), getMyOrders()]);
  const firstName = profile?.name?.split(" ")[0] || "there";

  const needsApproval = orders.filter((o) => o.status === "proof_ready");
  const active = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status as OrderStatus))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  const stats = [
    { label: "Total orders", value: orders.length },
    { label: "In progress", value: active.length },
    { label: "Approved", value: orders.filter((o) => APPROVED_STATUSES.includes(o.status as OrderStatus)).length },
    { label: "Completed", value: orders.filter((o) => o.status === "completed").length },
  ];

  const topProof = needsApproval[0];

  if (orders.length === 0) {
    return (
      <div className="space-y-8">
        <Greeting firstName={firstName} />
        <div className="rounded-lg border border-dream-line bg-white p-8 text-center shadow-sm">
          <Image
            src="/testimonailsplusfooter/dogasset.png"
            alt=""
            width={120}
            height={205}
            className="mx-auto mb-2 h-28 w-auto"
          />
          <h2 className="font-display text-xl font-bold text-dream-ink">No orders yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-dream-ink-soft">
            Pick a blank, add your art, and we&apos;ll take it from there. Free proof before anything prints.
          </p>
          <Link
            href="/shop"
            className="rough-pill rough-pill-filled mt-5 inline-flex items-center justify-center px-7 py-3.5 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Start designing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      <Greeting firstName={firstName} />

      {/* PRIMARY, the single action. Only shown when a proof is waiting, so it
          never competes with the rest of the page for attention. */}
      {topProof && (
        <section className="rounded-lg border border-dream-purple/25 bg-dream-lavender-soft/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-dream-ink">Ready for your approval</h2>
              <p className="text-sm text-dream-ink-soft">Approve the proof and we’ll get it printing.</p>
            </div>
            {needsApproval.length > 1 && (
              <span className="rounded-[3px] bg-white px-2.5 py-1 text-[14px] font-bold text-dream-purple">
                {needsApproval.length} waiting
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-md bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="font-display font-bold text-dream-ink">{topProof.order_number}</span>
              <p className="mt-0.5 text-sm text-dream-muted">
                {formatCAD(orderTotal(topProof))} · added {new Date(topProof.created_at).toLocaleDateString("en-CA")}
              </p>
            </div>
            <Link href={`/account/orders/${topProof.id}`} className="shrink-0">
              <Button variant="primary" size="sm">
                Review proof <IconChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* TERTIARY, a quiet glance. No per-stat links; the list below is the way in. */}
      <section className="rounded-lg border border-dream-line bg-white">
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-5 py-4 ${i < 2 ? "border-b border-dream-line sm:border-b-0" : ""} ${
                i % 2 === 0 ? "border-r border-dream-line" : ""
              } ${i === 1 ? "sm:border-r sm:border-dream-line" : ""}`}
            >
              <dt className="text-[14px] font-medium text-dream-muted">{s.label}</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold text-dream-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* SECONDARY, the main content: everything currently moving. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-dream-ink">In progress</h2>
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1 text-sm font-semibold text-dream-purple hover:underline"
          >
            View all orders <IconArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {active.length === 0 ? (
          <div className="rounded-lg border border-dream-line bg-white p-8 text-center">
            <p className="text-dream-muted">Nothing in progress right now.</p>
            <Link href="/shop" className="mt-3 inline-block">
              <Button variant="primary">Start a design</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {active.slice(0, MAX_IN_PROGRESS).map((o) => (
              <OrderListRow key={o.id} o={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Greeting({ firstName }: { firstName: string }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-dream-ink">Hi {firstName} 👋</h1>
      <p className="mt-1 text-dream-muted">Here’s what’s happening with your orders today.</p>
    </div>
  );
}
