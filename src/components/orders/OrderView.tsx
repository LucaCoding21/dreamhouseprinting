import Image from "next/image";
import Link from "next/link";
import { OrderTracker } from "@/components/portal/OrderTracker";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { PAYABLE_ORDER_STATUSES } from "@/lib/orderStatus";
import { StatusTag } from "@/components/portal/StatusTag";
import { OrderPanel } from "./OrderPanel";
import { ProofPanel } from "./ProofPanel";
import { InvoicePanel } from "./InvoicePanel";
import { BalanceDueBanner } from "./BalanceDueBanner";
import type { OrderViewProps } from "./types";

/**
 * The Julian-approved customer order view, shared verbatim by the logged-in
 * portal (/account/orders/[id]) and the public tokenized page (/o/[token]).
 * Renders its sections as siblings (no wrapper) so the hosting page controls
 * spacing, the portal keeps its exact `space-y-6` rhythm. Actions are passed
 * in already bound to the order/token by the route.
 */
export function OrderView({ order, lineItems, proofs, activity, stageDates, actions, etransfer }: OrderViewProps) {
  const pricing = order.pricing;
  // Always the LIVE total, admin pricing edits show (and charge) immediately;
  // the stamped invoice_amount is only a fallback for legacy rows.
  const amountDue = pricing.total ?? order.invoice_amount ?? 0;

  // Approve-and-pay: once the proof is approved the order is payable without an
  // invoice email. Pre-approval, an explicit invoice still unlocks payment. A
  // cancelled order is never payable (mirrors orderPayableError), otherwise it
  // would show a Pay-now button whose action then errors.
  const payable =
    !order.paid_at &&
    order.status !== "cancelled" &&
    amountDue > 0 &&
    (PAYABLE_ORDER_STATUSES.has(order.status) || !!order.invoice_sent_at);

  // The current proof set = the newest run of same-status proofs (a front/back
  // batch is sent together, so it sits contiguous at the top, newest-first).
  const proofSet = proofs.filter((p) => p.status === proofs[0]?.status);

  // Is a proof currently awaiting the customer's decision? Then ProofPanel's
  // "Approve & pay" is the payment prompt and the banner stays out of the way.
  const proofAwaitingDecision =
    proofSet.length > 0 && proofSet[0].status !== "approved" && proofSet[0].status !== "changes_requested";

  // Admin-skipped-proof path: the order is payable but nothing on the page asks
  // for money (no pending proof, no e-transfer being verified). Shout about it.
  const showBalanceDue = payable && !proofAwaitingDecision && !order.etransfer_reported_at;

  const paymentTag = order.paid_at ? (
    <StatusTag tone="success">Paid</StatusTag>
  ) : order.etransfer_reported_at ? (
    <StatusTag tone="warn">Confirming e-transfer</StatusTag>
  ) : undefined;

  // Order number shown in the "order" box header (merged with the items).
  const orderLabel = order.order_number
    ? `Order ${/^\d+$/.test(order.order_number) ? "#" : ""}${order.order_number}`
    : "Order";

  return (
    <>
      {/* Money first when it's owed and nothing else is asking for it. */}
      {showBalanceDue && (
        <BalanceDueBanner
          amountDue={amountDue}
          orderNumber={order.order_number}
          etransfer={etransfer}
          payNow={actions.payNow}
          reportEtransfer={actions.reportEtransfer}
        />
      )}

      {/* Where it is, the status hero, on top. */}
      <OrderTracker status={order.status} stageDates={stageDates} dueDate={order.due_date} />

      {/* Review and approve the proof, sits directly below the status module. */}
      {proofSet.length > 0 && (
        <ProofPanel
          proofs={proofSet}
          onApprove={actions.approveProof}
          onRequestChanges={actions.requestChanges}
          onPayNow={actions.payNow}
          onReportEtransfer={actions.reportEtransfer}
          payOnApprove={!order.paid_at && amountDue > 0}
          amountDue={amountDue}
          orderNumber={order.order_number}
          etransfer={etransfer}
        />
      )}

      {/* Order + payment side by side, two separate containers, same order. */}
      <div className="grid gap-6 md:grid-cols-[1.55fr_1fr] md:items-start">
        {/* What you ordered, order identity + its line items. */}
        <section className="rounded-3xl border border-dream-line bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-dream-line px-5 py-4">
            <h2 className="font-display text-xl font-extrabold leading-none text-dream-ink sm:text-2xl">{orderLabel}</h2>
          </div>
          <div className="p-5">
            <p className="mb-3 text-sm font-semibold text-dream-muted">Your items</p>
            <ul className="space-y-3">
              {lineItems.map((li) => {
                const pieces = Object.values(li.sizeQuantities).reduce((a, b) => a + (b > 0 ? b : 0), 0);
                return (
                  <li
                    key={li.id}
                    className="flex flex-wrap gap-3 rounded-2xl border border-dream-line bg-dream-cream/40 p-3 transition-colors hover:border-dream-purple/30 sm:flex-nowrap sm:gap-4"
                  >
                    {li.mockup ? (
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-dream-ink/10 bg-white">
                        <Image src={li.mockup} alt="" width={80} height={80} className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div
                        className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dream-ink/10 p-1 text-center"
                        style={{ backgroundColor: li.colourHex ?? "var(--color-dream-cream)" }}
                      >
                        {li.colourName && (
                          <span className="rounded bg-white/85 px-1 text-[14px] font-medium leading-tight text-dream-ink">
                            {li.colourName}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="break-words font-display text-[15px] font-bold text-dream-ink">{li.product_name}</div>
                      {li.colourName && <div className="text-sm text-dream-muted">{li.colourName}</div>}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {Object.entries(li.sizeQuantities)
                          .filter(([, q]) => q > 0)
                          .map(([s, q]) => (
                            <span
                              key={s}
                              className="inline-flex items-baseline gap-1 rounded-full bg-white px-2 py-0.5 text-[14px] font-medium text-dream-ink ring-1 ring-dream-line"
                            >
                              <span className="font-bold">{q}</span>
                              <span className="text-dream-muted">{s}</span>
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="ml-auto flex shrink-0 flex-col items-end">
                      <span className="font-display font-bold text-dream-ink">{formatCAD(li.line_total)}</span>
                      <span className="mt-0.5 text-[14px] text-dream-muted">
                        {pieces} {pieces === 1 ? "piece" : "pieces"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* What the customer told us, kept with the order so they can see
                the note they left is attached (and what staff edited it to). */}
            {order.customerNote && (
              <div className="mt-4 rounded-2xl border border-dream-line bg-dream-cream/40 p-4">
                <p className="font-display text-sm font-bold text-dream-ink">Your notes</p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-dream-muted">{order.customerNote}</p>
              </div>
            )}
          </div>
        </section>

        {/* The money, its own container, beside the order. */}
        <OrderPanel title="Payment summary" tag={paymentTag}>
          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatCAD(pricing.subtotal ?? 0)} />
            {!!pricing.setupFees && <Row label="Setup" value={formatCAD(pricing.setupFees)} />}
            {!!pricing.rush && <Row label="Rush fee" value={formatCAD(pricing.rush)} />}
            {!!pricing.addons && <Row label="Add-ons" value={formatCAD(pricing.addons)} />}
            {!!pricing.discount && (
              <Row label={pricing.discountLabel?.trim() || "Discount"} value={`−${formatCAD(pricing.discount)}`} accent />
            )}
            {/* Each named discount or fee gets its own line, no silent lumping. */}
            {(pricing.adjustments ?? [])
              .filter((a) => a.amount !== 0)
              .map((a) => (
                <Row
                  key={a.id}
                  label={a.label.trim() || (a.amount < 0 ? "Discount" : "Fee")}
                  value={`${a.amount < 0 ? "−" : ""}${formatCAD(Math.abs(a.amount))}`}
                  accent={a.amount < 0}
                />
              ))}
            {!!pricing.shipping && <Row label="Shipping" value={formatCAD(pricing.shipping)} />}
            {!!pricing.tax && <Row label="Tax" value={formatCAD(pricing.tax)} />}
          </div>

          {/* Total, the focal figure, in brand purple. */}
          <div className="mt-4 flex items-center justify-between border-t-2 border-dream-line pt-4">
            <span className="font-display text-lg font-bold text-dream-ink">Total</span>
            <span className="font-display text-2xl font-extrabold text-dream-purple">{formatCAD(pricing.total ?? 0)}</span>
          </div>

          {/* Payment action / status, same box, since it's all one transaction. */}
          {(payable || order.paid_at) && (
            <div className="mt-4 border-t border-dream-line pt-4">
              <InvoicePanel
                invoiceSentAt={order.invoice_sent_at}
                amountDue={amountDue}
                paidAt={order.paid_at}
                paymentMethod={order.payment_method}
                etransferReportedAt={order.etransfer_reported_at}
                orderNumber={order.order_number}
                etransfer={etransfer}
                payNow={actions.payNow}
                reportEtransfer={actions.reportEtransfer}
              />
            </div>
          )}

          <p className="mt-4 text-[14px] text-dream-muted">
            Questions?{" "}
            <Link href="/contact" className="font-semibold text-dream-purple hover:underline">
              Contact us
            </Link>
          </p>
        </OrderPanel>
      </div>

      {/* The record. */}
      {activity.length > 0 && (
        <OrderPanel title="Order history">
          <ol className="space-y-4">
            {activity.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="flex gap-3">
                <div className="mt-1 flex flex-col items-center">
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-dream-purple/15">
                    <span className="h-1.5 w-1.5 rounded-full bg-dream-purple" />
                  </span>
                  {i < activity.length - 1 && <span className="mt-1 w-px flex-1 bg-dream-line" />}
                </div>
                <div className="flex-1 pb-1">
                  <p className="text-sm text-dream-ink">{entry.text}</p>
                  <p className="mt-0.5 text-[14px] text-dream-muted">
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
        </OrderPanel>
      )}
    </>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("flex justify-between", accent ? "text-dream-ink" : "text-dream-muted")}>
      <span>{label}</span>
      <span className={accent ? "font-medium" : undefined}>{value}</span>
    </div>
  );
}
