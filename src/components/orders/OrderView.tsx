import Link from "next/link";
import { OrderTracker } from "@/components/portal/OrderTracker";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { PAYABLE_ORDER_STATUSES } from "@/lib/orderStatus";
import { swatchStyle } from "@/lib/swatch";
import { OrderPanel } from "./OrderPanel";
import { LineVisual } from "./LineVisual";
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

  // Once the set is approved the panel has nothing left to ask, and the proofs
  // themselves now sit on the lines they belong to, so it comes down. A
  // pending proof only asks for a decision while the order is at proof_ready:
  // one uploaded after approval (the press-ready artwork) shows on its line
  // but must not re-open the approval step.
  const showProofPanel =
    proofSet.length > 0 &&
    proofSet[0].status !== "approved" &&
    (proofSet[0].status !== "pending" || order.status === "proof_ready");

  // Every approved proof, per-line and legacy order-level alike, in one
  // "Approved proofs" strip under the items. Before any proof is approved the
  // strip shows the design mockups instead, so the artwork is always one tap
  // away (the item rows themselves carry a colour swatch, not the art).
  const approvedProofs = proofs.filter((p) => p.status === "approved");
  const mockups = approvedProofs.length
    ? []
    : Array.from(new Set(lineItems.map((li) => li.mockup).filter((m): m is string => !!m)));

  // Admin-skipped-proof path: the order is payable but nothing on the page asks
  // for money (no pending proof, no e-transfer being verified). Shout about it.
  const showBalanceDue = payable && !proofAwaitingDecision && !order.etransfer_reported_at;

  // Sits in the "Order details" header, opposite the title, so the state of
  // the order is legible before any of the numbers are read. Solid fill, not a
  // tinted chip: white on dream-success is 5.3:1 and reads at a glance, where
  // green-on-pale-green at 14px was both quiet and under AA.
  const paymentTag = order.paid_at ? (
    <span className="inline-flex shrink-0 items-center rounded-md bg-dream-success px-2.5 py-1 text-sm font-bold text-white">
      Paid
    </span>
  ) : order.etransfer_reported_at ? (
    <span className="inline-flex shrink-0 items-center rounded-md bg-dream-warn px-2.5 py-1 text-sm font-bold text-white">
      Confirming
    </span>
  ) : !order.paid_at && amountDue > 0 ? (
    <span className="inline-flex shrink-0 items-center rounded-md bg-dream-sun px-2.5 py-1 text-sm font-bold text-dream-ink">
      Unpaid
    </span>
  ) : undefined;

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
      {showProofPanel && (
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

      {/* One "Order details" card: items, the artwork strip, then the payment
          summary. Single column on phones; from md the money sits beside the
          items. */}
      <section className="rounded-2xl border border-dream-line bg-white shadow-sm sm:rounded-3xl">
        <div className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-extrabold text-dream-ink sm:text-2xl">Order details</h2>

          <div className="mt-4 md:grid md:grid-cols-[1.55fr_1fr] md:gap-8 md:items-start">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-dream-muted">Your items</p>
              <ul className="mt-0.5 divide-y divide-dream-line">
                {lineItems.map((li) => {
                  const pieces = Object.values(li.sizeQuantities).reduce((a, b) => a + (b > 0 ? b : 0), 0);
                  return (
                    <li key={li.id} className="flex gap-4 py-4">
                      {/* The garment itself: the approved proof or the design
                          mockup when there is one, otherwise the colour. Sits
                          on a soft tile so a white-background mockup still
                          reads as an object. */}
                      {li.mockup || li.proof ? (
                        <LineVisual
                          mockup={li.mockup}
                          proof={li.proof}
                          colourName={li.colourName}
                          colourHex={li.colourHex}
                          alt={[li.product_name, li.colourName].filter(Boolean).join(", ") || "Your item"}
                          className="shrink-0"
                        />
                      ) : (
                        <span
                          className="h-20 w-20 shrink-0 rounded-xl ring-1 ring-dream-ink/10"
                          style={swatchStyle({ name: li.colourName ?? "", hex: li.colourHex })}
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="break-words font-display text-[15px] font-bold leading-snug text-dream-ink">
                              {li.product_name}
                            </div>
                            {li.colourName && <div className="mt-1 text-sm text-dream-muted">{li.colourName}</div>}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-display font-bold text-dream-ink">{formatCAD(li.line_total)}</div>
                            <div className="mt-1 text-sm text-dream-muted">
                              {pieces} {pieces === 1 ? "piece" : "pieces"}
                            </div>
                          </div>
                        </div>
                        {/* Size run as one segmented strip: the cells share a
                            single tinted ground with hairlines between them, so
                            it reads as one spec rather than a row of outlined
                            boxes that looked like form inputs. */}
                        <div className="mt-3 inline-flex flex-wrap items-stretch overflow-hidden rounded-lg bg-dream-bg">
                          {sortSizes(Object.entries(li.sizeQuantities).filter(([, q]) => q > 0)).map(([sz, q], i) => (
                            <span
                              key={sz}
                              className={cn(
                                "inline-flex items-baseline gap-1 px-2.5 py-1.5 text-sm",
                                i > 0 && "border-l border-white",
                              )}
                            >
                              <span className="font-bold tabular-nums text-dream-purple">{q}</span>
                              <span className="text-dream-muted">{sz}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* The artwork: approved proofs once there are any, else the
                  design mockups. Each opens full size. */}
              {(approvedProofs.length > 0 || mockups.length > 0) && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-dream-muted">
                    {approvedProofs.length > 0
                      ? approvedProofs.length === 1
                        ? "Approved proof"
                        : "Approved proofs"
                      : "Your design"}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-5">
                    {approvedProofs.length > 0
                      ? approvedProofs.map((p, i) => (
                          <div key={p.id} className="flex flex-col items-center gap-1.5">
                            <LineVisual mockup={null} proof={p} colourName={null} colourHex={null} alt={`Approved proof ${i + 1}`} hideTag />
                            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-dream-success">
                              <CheckCircle className="h-4 w-4" />
                              Approved
                            </span>
                          </div>
                        ))
                      : mockups.map((m, i) => (
                          <div key={m} className="flex flex-col items-center gap-1.5">
                            <LineVisual mockup={m} proof={null} colourName={null} colourHex={null} alt={`Design mockup ${i + 1}`} hideTag />
                            <span className="text-[13px] font-medium text-dream-muted">Mockup</span>
                          </div>
                        ))}
                  </div>
                </div>
              )}

              {/* What the customer told us, kept with the order so they can see
                  the note they left is attached (and what staff edited it to). */}
              {order.customerNote && (
                // A rule, not a box: a card inside a card just added an edge
                // to look at, and the label already separates the note.
                <div className="mt-5 border-t border-dream-line pt-4">
                  <p className="text-sm font-semibold text-dream-muted">Your notes</p>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-dream-ink">{order.customerNote}</p>
                </div>
              )}
            </div>

            {/* The money, set apart on its own tinted panel so it reads as the
                summary of the items beside it rather than another item. */}
            <div className="mt-5 rounded-2xl border border-dream-line bg-dream-bg p-5 sm:p-6 md:mt-0 md:p-7">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-[15px] font-bold text-dream-ink">Payment summary</h3>
                {paymentTag}
              </div>
              <div className="mt-5 space-y-1.5 text-sm md:mt-6 md:space-y-2">
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

              {/* Total, the focal figure, in brand purple. Whether it is
                  settled is stated once, in the card header. */}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-dream-line-strong pt-5 md:mt-3.5 md:pt-7">
                <span className="font-display text-base font-bold text-dream-ink">Total</span>
                <span className="font-display text-xl font-extrabold text-dream-purple sm:text-2xl">{formatCAD(pricing.total ?? 0)}</span>
              </div>

              {/* Unpaid but payable: the pay strip (card / e-transfer /
                  confirming). Settled orders say so beside the total above. */}
              {!order.paid_at && (
                payable && (
                  <div className="mt-4">
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
                )
              )}

            </div>
          </div>
        </div>
      </section>

      {/* The record. Collapsed by default: it is a reference, not the point of the page. */}
      {activity.length > 0 && (
        <OrderPanel title={`Order history (${activity.length})`} collapsible defaultOpen={false}>
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

      {/* Last word on the page: the way out if anything here looks wrong. */}
      <p className="text-center text-sm text-dream-muted">
        Questions?{" "}
        <Link href="/contact" className="font-semibold text-dream-purple hover:underline">
          Contact us
        </Link>
      </p>
    </>
  );
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "4XL", "5XL", "6XL"];
function sortSizes(entries: [string, number][]): [string, number][] {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s.trim().toUpperCase());
    return i === -1 ? SIZE_ORDER.length : i;
  };
  return [...entries].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      <circle cx="10" cy="10" r="10" />
      <path d="M6 10.5l2.8 2.8L14 7.6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
