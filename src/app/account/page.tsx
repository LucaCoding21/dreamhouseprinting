import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { getMyOrders } from "@/lib/db/orders";
import { OrderTracker } from "@/components/portal/OrderTracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { STATUS_META } from "@/lib/orderStatus";
import { formatCAD } from "@/lib/money";
import type { OrderStatus } from "@/lib/db/rows";
import type { OrderRow } from "@/lib/db/rows";

const ACTIVE_STATUSES: OrderStatus[] = [
  "submitted",
  "in_review",
  "proof_ready",
  "changes_requested",
  "approved",
  "in_production",
  "quality_check",
  "shipped",
  "ready_for_pickup",
  "on_hold",
];

function orderTotal(o: OrderRow): number {
  const pricing = (o.pricing ?? {}) as { total?: number };
  return pricing.total ?? 0;
}

export default async function AccountDashboardPage() {
  const [profile, orders] = await Promise.all([getProfile(), getMyOrders()]);
  const firstName = profile?.name?.split(" ")[0] || "there";

  const proofReady = orders.filter((o) => o.status === "proof_ready");
  const balanceDue = orders.filter(
    (o) =>
      o.payment_status === "unpaid" &&
      o.status !== "draft" &&
      o.status !== "cancelled"
  );
  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status as OrderStatus));
  const hasActionNeeded = proofReady.length > 0 || balanceDue.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-dream-ink">
          Hi {firstName} 👋
        </h1>
        <p className="text-dream-muted">Track your orders, approve proofs, and start new designs.</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-10">
            <p className="text-dream-muted">You have no orders yet. Let’s make something.</p>
            <Link href="/shop">
              <Button variant="primary">Start a design</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {hasActionNeeded && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-dream-ink">Action needed</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {proofReady.map((o) => (
                  <Card key={`proof-${o.id}`} className="border-dream-purple">
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div>
                        <div className="font-medium text-dream-ink">Approve your proof</div>
                        <div className="text-sm text-dream-muted">
                          {o.order_number ?? "Order"} — your mockup is ready to review.
                        </div>
                      </div>
                      <Link href={`/account/orders/${o.id}`}>
                        <Button variant="primary" size="sm">
                          Review
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
                {balanceDue.map((o) => (
                  <Card key={`balance-${o.id}`} className="border-dream-warn">
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div>
                        <div className="font-medium text-dream-ink">Balance due</div>
                        <div className="text-sm text-dream-muted">
                          {o.order_number ?? "Order"} — {formatCAD(orderTotal(o))} outstanding.
                        </div>
                      </div>
                      <Link href={`/account/orders/${o.id}`}>
                        <Button variant="secondary" size="sm">
                          View order
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-dream-ink">Active orders</h2>
              <Link href="/account/orders" className="text-sm text-dream-muted hover:text-dream-ink">
                View all
              </Link>
            </div>
            {activeOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-start gap-3 py-8">
                  <p className="text-dream-muted">No active orders right now.</p>
                  <Link href="/shop">
                    <Button variant="primary">Start a design</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {activeOrders.map((o) => {
                  const meta = STATUS_META[o.status as OrderStatus];
                  return (
                    <Card key={o.id}>
                      <CardHeader className="flex-row items-center justify-between">
                        <Link href={`/account/orders/${o.id}`} className="group">
                          <CardTitle className="group-hover:text-dream-purple">
                            {o.order_number ?? "Order"}
                          </CardTitle>
                          <p className="text-sm text-dream-muted">
                            {new Date(o.created_at).toLocaleDateString("en-CA")} · {formatCAD(orderTotal(o))}
                          </p>
                        </Link>
                        <Badge variant={meta?.badge ?? "neutral"}>{meta?.label ?? o.status}</Badge>
                      </CardHeader>
                      <CardContent>
                        <OrderTracker status={o.status as OrderStatus} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
