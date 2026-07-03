import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import { markOrderPaid } from "@/lib/orders/payments";
import { serializeOrderView } from "@/lib/orders/orderView";
import { OrderView } from "@/components/orders/OrderView";
import SiteFooter from "@/components/SiteFooter";
import { StatusTag } from "@/components/portal/StatusTag";
import { STATUS_META } from "@/lib/orderStatus";
import type {
  OrderStatus,
  OrderRow,
  LineItemRow,
  DesignRow,
  ProofRow,
  OrderActivityRow,
} from "@/lib/db/rows";
import { approveProofPublicAction, requestProofChangesPublicAction, payNowPublicAction } from "./actions";

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
        // Stale/unknown session — render the order as-is.
      }
    }
  }

  const view = serializeOrderView(loaded);
  const { order } = view;
  const meta = STATUS_META[order.status as OrderStatus];

  return (
    <div className="flex min-h-dvh flex-col bg-dream-bg">
      <header className="border-b border-dream-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-5 py-4 lg:px-8">
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

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 py-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-2xl font-bold text-dream-ink">
            {order.order_number ?? "Order"}
          </h1>
          <StatusTag tone={meta?.badge ?? "neutral"}>{meta?.label ?? order.status}</StatusTag>
        </div>

        <OrderView
          order={view.order}
          lineItems={view.lineItems}
          proofs={view.proofs}
          firstMockup={view.firstMockup}
          activity={view.activity}
          actions={{
            approveProof: approveProofPublicAction.bind(null, token),
            requestChanges: requestProofChangesPublicAction.bind(null, token),
            payNow: payNowPublicAction.bind(null, token),
          }}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
