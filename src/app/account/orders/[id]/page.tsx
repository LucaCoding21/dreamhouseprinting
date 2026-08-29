import { notFound } from "next/navigation";
import Link from "next/link";
import { getMyOrder } from "@/lib/db/orders";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import { markOrderPaid } from "@/lib/orders/payments";
import { serializeOrderView, resolveEtransferOption, customerNoteFrom } from "@/lib/orders/orderView";
import { OrderView } from "@/components/orders/OrderView";
import { LatestMessageBanner } from "@/components/orders/LatestMessageBanner";
import { ReorderButton } from "./ReorderButton";
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
  // production_notes is staff-only too (not granted to `authenticated`), so the
  // customer-visible note is read here with the service client and passed in.
  // Only the `customer` key is extracted, the internal keys never leave this
  // function.
  const activityClient = requireSupabaseServiceClient();
  const [{ data: activity }, etransfer, { data: noteRow }] = await Promise.all([
    activityClient.from("order_activity").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
    // Resilient to an unmigrated DB: null (card only) if 0015's e-transfer columns
    // or the payments settings row are missing. Never throws.
    resolveEtransferOption(activityClient),
    activityClient.from("orders").select("production_notes").eq("id", order.id).maybeSingle(),
  ]);

  const view = serializeOrderView({
    order,
    lineItems,
    designs,
    proofs,
    activity: (activity ?? []) as OrderActivityRow[],
    customerNote: customerNoteFrom(noteRow?.production_notes),
  });

  const orderTitle = order.order_number
    ? `Order ${/^\d+$/.test(order.order_number) ? "#" : ""}${order.order_number}`
    : "Your order";
  const placedOn = new Date(order.created_at).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // space-y-4 (was 6) also sets the gaps inside OrderView, which renders its
  // sections as bare siblings so the host page owns the vertical rhythm.
  return (
    <div className="space-y-5">
      {/* Just-placed confirmation, first thing on the page and solid rather
          than a pale tint: it is the answer to "did that go through?", and as
          a washed-out strip below the title it was easy to miss. White on
          dream-success measures 5.3:1. */}
      {placed && (
        <div className="rounded-2xl bg-dream-success px-4 py-4 text-white sm:px-5">
          <p className="font-display text-base font-extrabold">Order received</p>
          <p className="mt-1 text-sm leading-snug text-white/90">
            We&rsquo;re reviewing your artwork. Your proof comes by email before anything prints.
          </p>
        </div>
      )}

      {/* Top row: the two navigation actions, back to the list and Reorder,
          both styled as buttons so they read as one control group. They sit
          above everything, including the message banner. */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/account/orders"
          className="group inline-flex h-10 items-center gap-1.5 rounded-lg border border-dream-line bg-white pl-3 pr-4 text-sm font-semibold text-dream-ink shadow-[0_1px_1px_0_rgba(27,20,88,0.05)] transition-shadow hover:border-dream-line-strong hover:bg-dream-cream hover:shadow-[0_1px_3px_0_rgba(27,20,88,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple focus-visible:ring-offset-2"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-dream-purple transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14.5 5.5L8 12l6.5 6.5" />
          </svg>
          My orders
        </Link>
        <ReorderButton orderId={order.id} />
      </div>

      {/* Page title: what this is (number + status + date). It used to first
          appear halfway down the page inside the items card. */}
      <div>
        <h1 className="font-display text-[22px] font-extrabold leading-none text-dream-ink sm:text-3xl">{orderTitle}</h1>
        <p className="mt-1 text-sm text-dream-muted">Placed {placedOn}</p>
      </div>

      {view.messages.length > 0 && <LatestMessageBanner messages={view.messages} />}

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
