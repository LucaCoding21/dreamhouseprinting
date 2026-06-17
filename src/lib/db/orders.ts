import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderRow, LineItemRow, DesignRow, ProofRow } from "@/lib/db/rows";

/** Customer order reads (RLS scopes to the logged-in user / their org). */

export async function getMyOrders(): Promise<OrderRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as OrderRow[];
}

export interface OrderDetail {
  order: OrderRow;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  proofs: ProofRow[];
}

export async function getMyOrder(id: string): Promise<OrderDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
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
    order: order as OrderRow,
    lineItems: (lineItems ?? []) as LineItemRow[],
    designs,
    proofs: (proofs ?? []) as ProofRow[],
  };
}
