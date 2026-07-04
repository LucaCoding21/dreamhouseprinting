import Image from "next/image";
import { OrderTracker } from "@/components/portal/OrderTracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCAD } from "@/lib/money";
import { ProofPanel } from "./ProofPanel";
import { InvoicePanel } from "./InvoicePanel";
import type { OrderViewProps } from "./types";

/**
 * The Julian-approved customer order view, shared verbatim by the logged-in
 * portal (/account/orders/[id]) and the public tokenized page (/o/[token]).
 * Renders its sections as siblings (no wrapper) so the hosting page controls
 * spacing — the portal keeps its exact `space-y-6` rhythm. Actions are passed
 * in already bound to the order/token by the route.
 */
export function OrderView({ order, lineItems, proofs, activity, actions }: OrderViewProps) {
  const latestProof = proofs[0];
  const pricing = order.pricing;
  const amountDue = order.invoice_amount ?? pricing.total ?? 0;

  return (
    <>
      <OrderTracker status={order.status} />

      {latestProof && (
        <ProofPanel
          proof={latestProof}
          onApprove={actions.approveProof}
          onRequestChanges={actions.requestChanges}
        />
      )}

      {order.invoice_sent_at && (
        <InvoicePanel
          invoiceSentAt={order.invoice_sent_at}
          amountDue={amountDue}
          paidAt={order.paid_at}
          payNow={actions.payNow}
        />
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineItems.map((li) => (
              <div key={li.id} className="flex gap-4">
                {li.mockup ? (
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-dream-line bg-dream-bg">
                    <Image src={li.mockup} alt="" width={80} height={80} className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div
                    className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dream-line p-1 text-center"
                    style={{ backgroundColor: li.colourHex ?? "var(--color-dream-bg)" }}
                  >
                    {li.colourName && (
                      <span className="rounded bg-white/85 px-1 text-[10px] font-medium leading-tight text-dream-ink">
                        {li.colourName}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-medium text-dream-ink">{li.product_name}</div>
                  <div className="text-sm text-dream-muted">{li.colourName}</div>
                  <div className="mt-1 text-sm text-dream-muted">
                    {Object.entries(li.sizeQuantities)
                      .filter(([, q]) => q > 0)
                      .map(([s, q]) => `${q}×${s}`)
                      .join("  ")}
                  </div>
                </div>
                <div className="text-right font-medium text-dream-ink">{formatCAD(li.line_total)}</div>
              </div>
            ))}
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
            {!!pricing.rush && (
              <div className="flex justify-between text-dream-muted">
                <span>Rush (+50%)</span>
                <span>{formatCAD(pricing.rush)}</span>
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

      {activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Order history</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {activity.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-dream-purple" />
                    {i < activity.length - 1 && <span className="mt-1 w-px flex-1 bg-dream-line" />}
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="text-sm text-dream-ink">{entry.text}</p>
                    <p className="mt-0.5 text-xs text-dream-muted">
                      {new Date(entry.at).toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </>
  );
}
