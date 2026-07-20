import { notFound } from "next/navigation";
import Link from "next/link";
import { getMyOrder } from "@/lib/db/orders";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import { markOrderPaid } from "@/lib/orders/payments";
import { serializeOrderView, resolveEtransferOption } from "@/lib/orders/orderView";
import { OrderView } from "@/components/orders/OrderView";
import { LatestMessageBanner } from "@/components/orders/LatestMessageBanner";
import { ReorderButton } from "./ReorderButton";
import { IconArrowLeft } from "@/components/portal/icons";
import type { OrderActivityRow } from "@/lib/db/rows";
import { approveProofAction, requestProofChangesAction } from "./actions";
import { payNowAction, reportEtransferAction } from "./pay-action";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string; session_id?: string }>;
}) {
  const { id } = await params;
  const { placed, session_id } = await searchParams;

  let detail = await getMyOrder(id);
  if (!detail) notFound();

  // Belt-and-braces reconcile: Stripe's success_url points at /o/{token}, so a
  // logged-in customer paying rarely lands here with a session_id, but if they
  // do, settle the order before render (revalidate=false: illegal in render).
  if (session_id && !detail.order.paid_at) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.metadata?.order_id === detail.order.id && session.payment_status === "paid") {
          await markOrderPaid(requireSupabaseServiceClient(), detail.order.id, session.id, "reconcile", false);
          const refreshed = await getMyOrder(id);
          if (refreshed) detail = refreshed;
        }
      } catch {
        // Stale/unknown session, ignore, show the order as-is.
      }
    }
  }

  const { order, lineItems, designs, proofs } = detail;

  // order_activity SELECT is revoked from the authenticated role (migration
  // 0014) so a customer cannot read internal activity entries straight from
  // PostgREST. Ownership is already proven: getMyOrder above returns null under
  // RLS unless this user may see the order, so reading its activity with the
  // service client is safe. serializeOrderView emits only customer-safe types.
  const activityClient = requireSupabaseServiceClient();
  const [{ data: activity }, etransfer] = await Promise.all([
    activityClient.from("order_activity").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
    // Resilient to an unmigrated DB: null (card only) if 0015's e-transfer columns
    // or the payments settings row are missing. Never throws.
    resolveEtransferOption(activityClient),
  ]);

  const view = serializeOrderView({
    order,
    lineItems,
    designs,
    proofs,
    activity: (activity ?? []) as OrderActivityRow[],
  });

  return (
    <div className="space-y-6">
      {view.latestMessage && <LatestMessageBanner message={view.latestMessage} />}

      {placed && (
        <div className="rounded-xl bg-dream-success-soft px-4 py-3 text-sm text-dream-success">
          🎉 Your order is in! We’ll review your artwork and send a proof shortly.
        </div>
      )}

      <div className="mb-2 flex items-center justify-between gap-3">
        <Link
          href="/account/orders"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-dream-muted transition-colors hover:text-dream-ink"
        >
          <IconArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          My orders
        </Link>
        <ReorderButton orderId={order.id} />
      </div>

      <OrderView
        order={view.order}
        lineItems={view.lineItems}
        proofs={view.proofs}
        activity={view.activity}
        stageDates={view.stageDates}
        actions={{
          approveProof: approveProofAction,
          requestChanges: requestProofChangesAction,
          payNow: payNowAction.bind(null, order.id),
          reportEtransfer: reportEtransferAction.bind(null, order.id),
        }}
        etransfer={etransfer}
      />
    </div>
  );
}
