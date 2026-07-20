import "server-only";

import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { OrderRow, LineItemRow, DesignRow, ProofRow, OrderActivityRow, ProfileRow, ProductRow, ProductColourJson } from "@/lib/db/rows";

/** Admin order reads (service client, staff see everything). Callers are permission-gated. */

export interface AdminOrderListItem {
  order: OrderRow;
  customerName: string | null;
  customerEmail: string | null;
  pieces: number;
  total: number;
  mockups: string[]; // signed/display urls
  latestNote: string | null;
}

const YEAR = 60 * 60 * 24 * 365;

function sumQuantities(items: LineItemRow[]): number {
  let n = 0;
  for (const li of items) {
    const sq = (li.size_quantities ?? {}) as Record<string, number>;
    for (const v of Object.values(sq)) n += v || 0;
  }
  return n;
}

export async function getAdminOrders(): Promise<AdminOrderListItem[]> {
  const supabase = requireSupabaseServiceClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (!orders || orders.length === 0) return [];

  const ids = orders.map((o) => o.id);
  const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))] as string[];

  const [{ data: lineItems }, { data: profiles }] = await Promise.all([
    supabase.from("line_items").select("*").in("order_id", ids),
    customerIds.length
      ? supabase.from("profiles").select("id, name, email").in("id", customerIds)
      : Promise.resolve({ data: [] as Pick<ProfileRow, "id" | "name" | "email">[] }),
  ]);

  const liByOrder = new Map<string, LineItemRow[]>();
  for (const li of (lineItems ?? []) as LineItemRow[]) {
    const arr = liByOrder.get(li.order_id) ?? [];
    arr.push(li);
    liByOrder.set(li.order_id, arr);
  }

  // Pull mockups from each order's designs (via line items) + official mockups.
  const designIds = [...new Set((lineItems ?? []).map((l) => l.design_id).filter(Boolean))] as string[];
  const designMockups = new Map<string, string | null>();
  if (designIds.length) {
    const { data: ds } = await supabase.from("designs").select("id, mockup_images").in("id", designIds);
    for (const d of ds ?? []) {
      const m = ((d.mockup_images ?? []) as { url: string | null }[]).find((x) => x.url)?.url ?? null;
      designMockups.set(d.id, m);
    }
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (orders as OrderRow[]).map((order) => {
    const items = liByOrder.get(order.id) ?? [];
    const pricing = (order.pricing ?? {}) as { total?: number };
    const profile = order.customer_id ? profileById.get(order.customer_id) : undefined;
    const mockups = items
      .map((li) => (li.design_id ? designMockups.get(li.design_id) : null))
      .filter(Boolean) as string[];
    const officials = ((order.official_mockups ?? []) as { url?: string }[]).map((m) => m.url).filter(Boolean) as string[];
    const cNotes = (order.customer_notes ?? []) as { text?: string }[];
    const iNotes = (order.internal_notes ?? []) as { text?: string }[];
    const latestNote = [...iNotes, ...cNotes].slice(-1)[0]?.text ?? null;

    // Guests have no profile, fall back to the order's guest email + ship-to name.
    const ship = (order.shipping_address ?? {}) as { name?: string };
    return {
      order,
      customerName: profile?.name ?? ship.name ?? null,
      customerEmail: profile?.email ?? order.guest_email ?? null,
      pieces: sumQuantities(items),
      total: pricing.total ?? 0,
      mockups: [...officials, ...mockups],
      latestNote,
    };
  });
}

/** The S&S source fields a line item's garment resolves to (for reordering blanks). */
export type OrderProduct = Pick<ProductRow, "id" | "name" | "brand" | "ss_style_name" | "ss_style_id"> & {
  /** Per-colour S&S CDN blank images, so admin can pull the exact blank garment for a line. */
  colours: ProductColourJson[] | null;
};

export interface AdminOrderDetail {
  order: OrderRow;
  customer: Pick<ProfileRow, "id" | "name" | "email" | "phone"> | null;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  products: OrderProduct[];
  proofs: ProofRow[];
  activity: OrderActivityRow[];
}

export async function getAdminOrder(id: string): Promise<AdminOrderDetail | null> {
  const supabase = requireSupabaseServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) return null;

  const [{ data: lineItems }, { data: proofs }, { data: activity }] = await Promise.all([
    supabase.from("line_items").select("*").eq("order_id", id),
    supabase.from("proofs").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("order_activity").select("*").eq("order_id", id).order("created_at", { ascending: false }),
  ]);

  const designIds = (lineItems ?? []).map((l) => l.design_id).filter(Boolean) as string[];
  let designs: DesignRow[] = [];
  if (designIds.length) {
    const { data } = await supabase.from("designs").select("*").in("id", designIds);
    designs = (data ?? []) as DesignRow[];
  }

  const productIds = [...new Set((lineItems ?? []).map((l) => l.product_id).filter(Boolean))] as string[];
  let products: AdminOrderDetail["products"] = [];
  if (productIds.length) {
    const { data } = await supabase
      .from("products")
      .select("id, name, brand, ss_style_name, ss_style_id, colours")
      .in("id", productIds);
    products = (data ?? []) as AdminOrderDetail["products"];
  }

  let customer: AdminOrderDetail["customer"] = null;
  if (order.customer_id) {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, email, phone")
      .eq("id", order.customer_id)
      .maybeSingle();
    customer = data ?? null;
  } else {
    // Guest order, synthesize a contact from the order's guest email + ship-to.
    const ship = (order.shipping_address ?? {}) as { name?: string; phone?: string };
    if (order.guest_email || ship.name) {
      customer = { id: "guest", name: ship.name ?? null, email: order.guest_email ?? null, phone: ship.phone ?? null };
    }
  }

  return {
    order: order as OrderRow,
    customer,
    lineItems: (lineItems ?? []) as LineItemRow[],
    designs,
    products,
    proofs: (proofs ?? []) as ProofRow[],
    activity: (activity ?? []) as OrderActivityRow[],
  };
}

/** Re-sign a stored artwork/mockup path for fresh display (paths outlive their signed urls). */
export async function signPath(bucket: string, path: string): Promise<string | null> {
  const supabase = requireSupabaseServiceClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, YEAR);
  return data?.signedUrl ?? null;
}
