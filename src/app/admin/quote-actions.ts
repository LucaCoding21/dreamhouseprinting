"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, getProfile } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { Json, Database } from "@/lib/db/types";

// "use server" files may only export async functions, so the status union lives
// as a local (non-exported) type here; QuotesClient owns the shared list + labels.
type QuoteStatus = "requested" | "sent" | "accepted" | "declined" | "converted";

type QuoteUpdate = Database["public"]["Tables"]["quotes"]["Update"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type LineItemInsert = Database["public"]["Tables"]["line_items"]["Insert"];

const asJson = (v: unknown) => v as unknown as Json;

/** Shape of a quote line item carried over when converting to an order. */
interface QuoteLineItem {
  product_id?: string | null;
  product_name?: string | null;
  design_id?: string | null;
  decoration_method_id?: string | null;
  colour?: unknown;
  size_quantities?: unknown;
  decorations?: unknown;
  unit_price?: number;
  setup_fee?: number;
  line_total?: number;
}

function revalidateQuotes() {
  revalidatePath("/admin");
}

export async function setQuoteStatusAction(
  quoteId: string,
  status: QuoteStatus
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("quotes.manage");
  const service = requireSupabaseServiceClient();

  const patch: QuoteUpdate = { status };
  const { error } = await service.from("quotes").update(patch).eq("id", quoteId);
  if (error) return { error: error.message };

  revalidateQuotes();
  return { ok: true };
}

export async function convertQuoteToOrderAction(
  quoteId: string
): Promise<{ orderId?: string; error?: string }> {
  await requirePermission("quotes.manage");
  const service = requireSupabaseServiceClient();
  const profile = await getProfile();

  const { data: quote, error: loadErr } = await service
    .from("quotes")
    .select("id, customer_id, organization_id, pricing, line_items, status, converted_order_id")
    .eq("id", quoteId)
    .single();
  if (loadErr) return { error: loadErr.message };
  if (!quote) return { error: "Quote not found." };
  if (quote.converted_order_id) return { error: "This quote is already converted." };

  // Create the order from the quote's pricing snapshot.
  const orderInsert: OrderInsert = {
    customer_id: quote.customer_id,
    organization_id: quote.organization_id,
    status: "submitted",
    payment_status: "unpaid",
    pricing: asJson(quote.pricing ?? {}),
    sales_rep: profile?.name ?? null,
  };

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert(orderInsert)
    .select("id")
    .single();
  if (orderErr) return { error: orderErr.message };
  if (!order) return { error: "Could not create the order." };

  // Carry over any line items captured on the quote (else leave the order item-less).
  const quoteItems = (quote.line_items ?? []) as unknown as QuoteLineItem[];
  if (Array.isArray(quoteItems) && quoteItems.length > 0) {
    const rows: LineItemInsert[] = quoteItems.map((li) => ({
      order_id: order.id,
      product_id: li.product_id ?? null,
      product_name: li.product_name ?? null,
      design_id: li.design_id ?? null,
      decoration_method_id: li.decoration_method_id ?? null,
      colour: asJson(li.colour ?? null),
      size_quantities: asJson(li.size_quantities ?? {}),
      decorations: asJson(li.decorations ?? []),
      unit_price: li.unit_price ?? 0,
      setup_fee: li.setup_fee ?? 0,
      line_total: li.line_total ?? 0,
    }));
    const { error: liErr } = await service.from("line_items").insert(rows);
    if (liErr) return { error: liErr.message };
  }

  // Mark the quote converted and link it to the new order.
  const patch: QuoteUpdate = { status: "converted", converted_order_id: order.id };
  const { error: quoteErr } = await service.from("quotes").update(patch).eq("id", quoteId);
  if (quoteErr) return { error: quoteErr.message };

  revalidateQuotes();
  revalidatePath("/admin/orders");
  return { orderId: order.id };
}
