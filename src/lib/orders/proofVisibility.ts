import type { OrderStatus } from "@/lib/db/rows";

/**
 * Can the customer see this proof on their order page? Shared by the customer
 * serializer (what actually renders) and the admin line thumb (the hint that a
 * proof is not customer-visible yet), so the two never disagree.
 *
 * - Decided proofs (approved / changes requested) are history, always visible.
 * - A pending proof is a draft until the admin sends the order for approval
 *   (status proof_ready). Julian: "upload should just be upload".
 * - EXCEPT once the order is past approval (approved, in production, shipped
 *   ...): a proof uploaded then is the final artwork going to press, and the
 *   approval step is over, so it shows on its line right away. Julian: "the
 *   photo is still the original photo not the PDF mock up". Approve/request
 *   changes are locked server-side outside the pre-approval statuses
 *   (proofDecision.ts), so nothing can be re-decided from this.
 */
const PAST_APPROVAL = new Set<OrderStatus>([
  "approved",
  "in_production",
  "quality_check",
  "shipped",
  "ready_for_pickup",
  "completed",
]);

export function customerCanSeeProof(proofStatus: string, orderStatus: OrderStatus | string): boolean {
  if (proofStatus !== "pending") return true;
  return orderStatus === "proof_ready" || PAST_APPROVAL.has(orderStatus as OrderStatus);
}
