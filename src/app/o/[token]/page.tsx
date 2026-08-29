import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import { markOrderPaid } from "@/lib/orders/payments";
import { serializeOrderView, resolveEtransferOption, designMockup } from "@/lib/orders/orderView";
import type { OrderStatus } from "@/lib/db/rows";
import { OrderView } from "@/components/orders/OrderView";
import { LatestMessageBanner } from "@/components/orders/LatestMessageBanner";
import { SiblingOrdersBanner, type SiblingOrder } from "@/components/orders/SiblingOrdersBanner";
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

/** Max sibling orders we will resolve from one `?also=` param. A cart holding
 *  more than this is not a thing that happens; the cap just bounds the query. */
const MAX_SIBLINGS = 12;

/**
 * Resolve the other orders placed in the same checkout, with enough detail to
 * recognise them on sight: mockup, what's in it, pieces, total, status.
 *
 * The param carries only tokens; every value rendered is read from the database,
 * so a hand-edited URL cannot make the page claim an order that does not exist
 * or misstate one that does.
 */
async function loadSiblings(raw: string | undefined, currentToken: string): Promise<SiblingOrder[]> {
  if (!raw) return [];
  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t && t !== currentToken)
    .slice(0, MAX_SIBLINGS);
  if (!tokens.length) return [];

  const service = requireSupabaseServiceClient();
  const { data: orders } = await service
    .from("orders")
    .select("id, order_number, public_token, status, pricing")
    .in("public_token", tokens);
  if (!orders?.length) return [];

  const { data: lineItems } = await service
    .from("line_items")
    .select("order_id, design_id, product_name, colour, size_quantities")
    .in(
      "order_id",
      orders.map((o) => o.id),
    );

  const designIds = [...new Set((lineItems ?? []).map((l) => l.design_id).filter(Boolean))] as string[];
  let designs: DesignRow[] = [];
  if (designIds.length) {
    const { data } = await service.from("designs").select("*").in("id", designIds);
    designs = (data ?? []) as DesignRow[];
  }
  const mockupByDesign = new Map(designs.map((d) => [d.id, designMockup(d)]));

  const byToken = new Map(orders.map((o) => [o.public_token, o]));

  // Keep the order the cart placed them in, not whatever the query returns.
  return tokens.flatMap((t) => {
    const o = byToken.get(t);
    if (!o?.public_token) return [];
    const lines = (lineItems ?? []).filter((l) => l.order_id === o.id);

    // Name the order by its product. Several colourways of one garment read as
    // one thing to the customer, so dedupe before counting.
    const names = [...new Set(lines.map((l) => l.product_name).filter(Boolean))] as string[];
    const title =
      names.length === 0
        ? "Custom order"
        : names.length === 1
          ? names[0]
          : `${names[0]} + ${names.length - 1} more`;

    // Pieces live in the size run, not a column, same as everywhere else.
    const pieces = lines.reduce((sum, l) => {
      const sizes = (l.size_quantities ?? {}) as Record<string, number>;
      return sum + Object.values(sizes).reduce((n, q) => n + (Number(q) || 0), 0);
    }, 0);
    const colours = [...new Set(lines.map((l) => (l.colour as { name?: string } | null)?.name).filter(Boolean))] as string[];
    const mockup = lines.map((l) => (l.design_id ? mockupByDesign.get(l.design_id) : null)).find(Boolean) ?? null;
    const total = (o.pricing as { total?: number } | null)?.total ?? null;

    return [
      {
        number: o.order_number ?? "Your order",
        token: o.public_token,
        title,
        pieces,
        colours,
        total,
        mockup: mockup ?? null,
        status: o.status as OrderStatus,
      },
    ];
  });
}

export default async function PublicOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string; also?: string }>;
}) {
  const { token } = await params;
  const { session_id, also } = await searchParams;

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

  // Only present right after a multi-design checkout, which links here with the
  // sibling tokens in `?also=`.
  const siblings = await loadSiblings(also, token);

  return (
    <div className="flex min-h-dvh flex-col bg-dream-cream">
      <header className="border-b border-dream-ink/10 bg-dream-lavender-soft">
        <div className="mx-auto flex max-w-5xl items-center px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/dreamhouse-logo4.svg"
              alt="Dreamhouse Printing"
              width={1668}
              height={547}
              className="h-10 w-auto lg:h-12"
            />
          </Link>
        </div>
      </header>

      {/* space-y-4 (was 6) sets the rhythm for every OrderView section too: it
          renders siblings with no wrapper, so the host page owns the spacing.
          pt-6 still clears the header, which is in normal flow above. */}
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-5 pb-10 pt-6 lg:px-8">
        <SiblingOrdersBanner
          current={loaded.order.order_number}
          currentToken={token}
          siblings={siblings}
        />

        {view.messages.length > 0 && <LatestMessageBanner messages={view.messages} />}

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
