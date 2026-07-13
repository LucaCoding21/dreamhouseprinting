import { notFound } from "next/navigation";
import Link from "next/link";
import { getMyOrder } from "@/lib/db/orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import { markOrderPaid } from "@/lib/orders/payments";
import { serializeOrderView } from "@/lib/orders/orderView";
import { OrderView } from "@/components/orders/OrderView";
import { LatestMessageBanner } from "@/components/orders/LatestMessageBanner";
import { ReorderButton } from "./ReorderButton";
import { StatusTag } from "@/components/portal/StatusTag";
import { IconArrowLeft } from "@/components/portal/icons";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus, OrderActivityRow } from "@/lib/db/rows";
import { approveProofAction, requestProofChangesAction } from "./actions";
import { payNowAction } from "./pay-action";

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
  // logged-in customer paying rarely lands here with a session_id — but if they
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
        // Stale/unknown session — ignore, show the order as-is.
      }
    }
  }

  const { order, lineItems, designs, proofs } = detail;

  const supa = await createSupabaseServerClient();
  const { data: activity } = await supa
    .from("order_activity")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });

  const view = serializeOrderView({
    order,
    lineItems,
    designs,
    proofs,
    activity: (activity ?? []) as OrderActivityRow[],
  });

  const meta = STATUS_META[order.status as OrderStatus];

  return (
    <div className="space-y-6">
      {view.latestMessage && <LatestMessageBanner message={view.latestMessage} />}

      {placed && (
        <div className="rounded-xl bg-dream-success-soft px-4 py-3 text-sm text-dream-success">
          🎉 Your order is in! We’ll review your artwork and send a proof shortly.
        </div>
      )}

      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <Link
            href="/account/orders"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-dream-muted transition-colors hover:text-dream-ink"
          >
            <IconArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            My orders
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold text-dream-ink">
              {order.order_number ?? "Order"}
            </h1>
            <StatusTag tone={meta?.badge ?? "neutral"}>{meta?.label ?? order.status}</StatusTag>
          </div>
        </div>
        <ReorderButton orderId={order.id} />
      </div>

      <OrderView
        order={view.order}
        lineItems={view.lineItems}
        proofs={view.proofs}
        activity={view.activity}
        actions={{
          approveProof: approveProofAction,
          requestChanges: requestProofChangesAction,
          payNow: payNowAction.bind(null, order.id),
        }}
      />
    </div>
  );
}
