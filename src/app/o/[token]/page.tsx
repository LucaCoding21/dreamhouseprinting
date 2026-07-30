import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import { markOrderPaid } from "@/lib/orders/payments";
import { serializeOrderView, resolveEtransferOption } from "@/lib/orders/orderView";
import { OrderView } from "@/components/orders/OrderView";
import { LatestMessageBanner } from "@/components/orders/LatestMessageBanner";
import SiteFooter from "@/components/SiteFooter";
import type {
  OrderRow,
  LineItemRow,
  DesignRow,
  ProofRow,
  OrderActivityRow,
} from "@/lib/db/rows";
import {
  approveProofPublicAction,
  requestProofChangesPublicAction,
  payNowPublicAction,
  reportEtransferPublicAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

interface Loaded {
  order: OrderRow;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  proofs: ProofRow[];
  activity: OrderActivityRow[];
}

async function loadByToken(token: string): Promise<Loaded | null> {
  const service = requireSupabaseServiceClient();
  const { data: order } = await service.from("orders").select("*").eq("public_token", token).maybeSingle();
  if (!order) return null;

  const [{ data: lineItems }, { data: proofs }, { data: activity }] = await Promise.all([
    service.from("line_items").select("*").eq("order_id", order.id),
    service.from("proofs").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
    service.from("order_activity").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
  ]);

  const designIds = (lineItems ?? []).map((l) => l.design_id).filter(Boolean) as string[];
  let designs: DesignRow[] = [];
  if (designIds.length) {
    const { data } = await service.from("designs").select("*").in("id", designIds);
    designs = (data ?? []) as DesignRow[];
  }

  return {
    order: order as OrderRow,
    lineItems: (lineItems ?? []) as LineItemRow[],
    designs,
    proofs: (proofs ?? []) as ProofRow[],
    activity: (activity ?? []) as OrderActivityRow[],
  };
}

export default async function PublicOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { token } = await params;
  const { session_id } = await searchParams;

  let loaded = await loadByToken(token);
  if (!loaded) notFound();

  // Reconcile-on-return: Stripe redirects here with ?session_id after payment.
  if (session_id && !loaded.order.paid_at) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.metadata?.order_id === loaded.order.id && session.payment_status === "paid") {
          await markOrderPaid(requireSupabaseServiceClient(), loaded.order.id, session.id, "reconcile", false);
          const refreshed = await loadByToken(token);
          if (refreshed) loaded = refreshed;
        }
      } catch {
        // Stale/unknown session, render the order as-is.
      }
    }
  }

  const view = serializeOrderView(loaded);

  // Resilient to an unmigrated DB: returns null (card only) if 0015's e-transfer
  // columns or the payments settings row are missing. Never throws.
  const etransfer = await resolveEtransferOption(requireSupabaseServiceClient());

  return (
    <div className="flex min-h-dvh flex-col bg-dream-cream">
      <header className="border-b border-dream-ink/10 bg-dream-lavender-soft">
        <div className="mx-auto flex max-w-5xl items-center px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/dreamhouse-logo-full.png"
              alt="Dreamhouse Printing"
              width={1800}
              height={600}
              className="h-9 w-auto lg:h-11"
            />
          </Link>
        </div>
      </header>

      {/* space-y-4 (was 6) sets the rhythm for every OrderView section too: it
          renders siblings with no wrapper, so the host page owns the spacing.
          pt-6 still clears the header, which is in normal flow above. */}
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-5 pb-10 pt-6 lg:px-8">
        {view.latestMessage && <LatestMessageBanner message={view.latestMessage} />}

        <OrderView
          order={view.order}
          lineItems={view.lineItems}
          proofs={view.proofs}
          activity={view.activity}
          stageDates={view.stageDates}
          actions={{
            approveProof: approveProofPublicAction.bind(null, token),
            requestChanges: requestProofChangesPublicAction.bind(null, token),
            payNow: payNowPublicAction.bind(null, token),
            reportEtransfer: reportEtransferPublicAction.bind(null, token),
          }}
          etransfer={etransfer}
        />
      </main>

      <SiteFooter hideDog />
    </div>
  );
}
