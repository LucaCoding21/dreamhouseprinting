import Link from "next/link";
import { getMyOrders } from "@/lib/db/orders";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { STATUS_META } from "@/lib/orderStatus";
import { formatCAD } from "@/lib/money";
import type { OrderStatus } from "@/lib/db/rows";

export default async function MyOrdersPage() {
  const orders = await getMyOrders();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-dream-ink">My orders</h1>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Design something and place your first order."
          action={
            <Link href="/shop">
              <Button variant="primary">Start a design</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const meta = STATUS_META[o.status as OrderStatus];
            const pricing = (o.pricing ?? {}) as { total?: number };
            return (
              <Link key={o.id} href={`/account/orders/${o.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="font-medium text-dream-ink">{o.order_number}</div>
                      <div className="text-sm text-dream-muted">
                        {new Date(o.created_at).toLocaleDateString("en-CA")}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-dream-ink">{formatCAD(pricing.total ?? 0)}</span>
                      <Badge variant={meta?.badge ?? "neutral"}>{meta?.label ?? o.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
