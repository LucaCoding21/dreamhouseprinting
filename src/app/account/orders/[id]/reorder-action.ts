"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/db/types";

const asJson = (v: unknown) => v as unknown as Json;

/**
 * Reorder: clone an existing order the requesting user owns into a fresh
 * submitted/unpaid order, copying its line items (same designs/products) and
 * pricing. Returns the new order id. Ownership is enforced against
 * order.customer_id so a customer can only reorder their own work.
 */
export async function reorderAction(
  orderId: string
): Promise<{ orderId?: string; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Please sign in to reorder." };
  const service = requireSupabaseServiceClient();

  const { data: original, error: orderErr } = await service
    .from("orders")
    .select("customer_id, organization_id, pricing")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) return { error: orderErr.message };
  if (!original) return { error: "Order not found." };
  if (original.customer_id !== user.id) return { error: "You can only reorder your own orders." };

  const { data: lineItems, error: liErr } = await service
    .from("line_items")
    .select("*")
    .eq("order_id", orderId);
  if (liErr) return { error: liErr.message };
  if (!lineItems || lineItems.length === 0) return { error: "This order has no items to reorder." };

  const { data: newOrder, error: newErr } = await service
    .from("orders")
    .insert({
      customer_id: user.id,
      organization_id: original.organization_id,
      status: "submitted",
      payment_status: "unpaid",
      pricing: asJson(original.pricing),
    })
    .select("id")
    .single();
  if (newErr) return { error: newErr.message };

  const { error: copyErr } = await service.from("line_items").insert(
    lineItems.map((li) => ({
      order_id: newOrder.id,
      design_id: li.design_id,
      product_id: li.product_id,
      product_name: li.product_name,
      decoration_method_id: li.decoration_method_id,
      colour: asJson(li.colour),
      size_quantities: asJson(li.size_quantities),
      decorations: asJson(li.decorations),
      unit_price: li.unit_price,
      setup_fee: li.setup_fee,
      line_total: li.line_total,
    }))
  );
  if (copyErr) return { error: copyErr.message };

  await service.from("order_activity").insert({
    order_id: newOrder.id,
    actor_id: user.id,
    actor_name: "Customer",
    type: "reorder",
    detail: asJson({ from_order_id: orderId }),
  });

  revalidatePath("/account");
  revalidatePath("/account/orders");
  return { orderId: newOrder.id };
}
