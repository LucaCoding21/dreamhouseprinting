import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderRow, LineItemRow, DesignRow, ProofRow } from "@/lib/db/rows";

/** Customer order reads (RLS scopes to the logged-in user / their org). */

// Explicit column list, kept in lockstep with migration 0014's GRANT SELECT on
// public.orders to `authenticated`. The staff-only columns (internal_notes,
// production_notes, hold_note, sales_rep) are NOT granted to the authenticated
// role, so `select("*")` would fail with a permission error here — select only
// the customer-safe columns. Service-client reads (admin) keep full access.
const CUSTOMER_ORDER_COLUMNS =
  "id, order_number, customer_id, organization_id, status, payment_status, " +
  "pricing, official_mockups, customer_notes, due_date, shipping_address, " +
  "billing_address, shipping_method, fulfillment_method, shipping_tracking, " +
  "guest_email, public_token, stripe_checkout_session_id, invoice_sent_at, " +
  "invoice_amount, paid_at, created_at, updated_at";

export async function getMyOrders(): Promise<OrderRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select(CUSTOMER_ORDER_COLUMNS)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as OrderRow[];
}

export interface OrderDetail {
  order: OrderRow;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  proofs: ProofRow[];
}

export async function getMyOrder(id: string): Promise<OrderDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select(CUSTOMER_ORDER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!order) return null;

  const [{ data: lineItems }, { data: proofs }] = await Promise.all([
    supabase.from("line_items").select("*").eq("order_id", id),
    supabase.from("proofs").select("*").eq("order_id", id).order("created_at", { ascending: false }),
  ]);

  const designIds = (lineItems ?? []).map((l) => l.design_id).filter(Boolean) as string[];
  let designs: DesignRow[] = [];
  if (designIds.length) {
    const { data } = await supabase.from("designs").select("*").in("id", designIds);
    designs = (data ?? []) as DesignRow[];
  }

  return {
    order: order as unknown as OrderRow,
    lineItems: (lineItems ?? []) as LineItemRow[],
    designs,
    proofs: (proofs ?? []) as ProofRow[],
  };
}
