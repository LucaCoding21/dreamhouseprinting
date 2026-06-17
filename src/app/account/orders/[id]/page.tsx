import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getMyOrder } from "@/lib/db/orders";
import { OrderTracker } from "@/components/portal/OrderTracker";
import { ProofApproval } from "./ProofApproval";
import { ReorderButton } from "./ReorderButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { STATUS_META } from "@/lib/orderStatus";
import { formatCAD } from "@/lib/money";
import type { OrderStatus } from "@/lib/db/rows";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { id } = await params;
  const { placed } = await searchParams;
  const detail = await getMyOrder(id);
  if (!detail) notFound();

  const { order, lineItems, designs, proofs } = detail;
  const latestProof = proofs[0];
  const meta = STATUS_META[order.status as OrderStatus];
  const pricing = (order.pricing ?? {}) as { total?: number; subtotal?: number; setupFees?: number };
  const firstMockup = designs
    .flatMap((d) => (d.mockup_images ?? []) as { view: string; url: string | null }[])
    .find((m) => m.url)?.url;

  return (
    <div className="space-y-6">
      {placed && (
        <div className="rounded-xl bg-dream-success-soft px-4 py-3 text-sm text-dream-success">
          🎉 Your order is in! We’ll review your artwork and send a proof shortly.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <Link href="/account/orders" className="text-sm text-dream-muted hover:text-dream-ink">
            ← My orders
          </Link>
          <h1 className="font-display text-2xl font-bold text-dream-ink">
            {order.order_number ?? "Order"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ReorderButton orderId={order.id} />
          <Badge variant={meta?.badge ?? "neutral"}>{meta?.label ?? order.status}</Badge>
        </div>
      </div>

      <OrderTracker status={order.status as OrderStatus} />

      {latestProof && (
        <ProofApproval
          proof={{
            id: latestProof.id,
            image: latestProof.image,
            status: latestProof.status,
            change_request_comment: latestProof.change_request_comment,
          }}
        />
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineItems.map((li) => {
              const colour = (li.colour ?? {}) as { name?: string };
              const sizes = (li.size_quantities ?? {}) as Record<string, number>;
              return (
                <div key={li.id} className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-dream-line bg-dream-bg">
                    {firstMockup && (
                      <Image src={firstMockup} alt="" width={80} height={80} className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-dream-ink">{li.product_name}</div>
                    <div className="text-sm text-dream-muted">{colour.name}</div>
                    <div className="mt-1 text-sm text-dream-muted">
                      {Object.entries(sizes)
                        .filter(([, q]) => q > 0)
                        .map(([s, q]) => `${q}×${s}`)
                        .join("  ")}
                    </div>
                  </div>
                  <div className="text-right font-medium text-dream-ink">{formatCAD(li.line_total)}</div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between text-dream-muted">
              <span>Subtotal</span>
              <span>{formatCAD(pricing.subtotal ?? 0)}</span>
            </div>
            {!!pricing.setupFees && (
              <div className="flex justify-between text-dream-muted">
                <span>Setup</span>
                <span>{formatCAD(pricing.setupFees)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-dream-line pt-2 font-semibold text-dream-ink">
              <span>Total</span>
              <span>{formatCAD(pricing.total ?? 0)}</span>
            </div>
            {order.due_date && (
              <p className="pt-3 text-xs text-dream-muted">Estimated ready by {order.due_date}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
