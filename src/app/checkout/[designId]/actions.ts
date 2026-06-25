"use server";

import { getUser } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { calcTax, isProvinceCode } from "@/lib/pricing/tax";
import type { Json } from "@/lib/db/types";

const asJson = (v: unknown) => v as unknown as Json;

interface StoredAddress {
  name?: string;
  company?: string | null;
  phone?: string;
  street?: string;
  city?: string;
  prov?: string;
  postal?: string;
  country?: string;
}
interface StoredSnapshot {
  unitPrice?: number;
  subtotal?: number;
  setupTotal?: number;
  total?: number;
  quantity?: number;
}

export interface CheckoutContactInput {
  designId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
  street: string;
  city: string;
  province: string;
  postal: string;
}

/**
 * Persist the checkout contact + shipping address to the customer's profile so
 * it prefills next time and feeds the Order once it's placed. The Order itself
 * is created later in the funnel (after shipping + payment), so this only writes
 * the profile — abandoning here leaves no half-built order behind.
 */
export async function saveContactAction(
  input: CheckoutContactInput
): Promise<{ ok?: boolean; needsLogin?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { needsLogin: true };
  const service = requireSupabaseServiceClient();

  // Make sure the design belongs to this customer before we tie anything to it.
  const { data: design } = await service
    .from("designs")
    .select("id")
    .eq("id", input.designId)
    .eq("customer_id", user.id)
    .single();
  if (!design) return { error: "Design not found." };

  const fullName = `${input.firstName} ${input.lastName}`.replace(/\s+/g, " ").trim();
  const address = {
    label: "Primary",
    name: fullName,
    company: input.company?.trim() || null,
    phone: input.phone.trim(),
    street: input.street.trim(),
    city: input.city.trim(),
    prov: input.province,
    postal: input.postal.trim().toUpperCase(),
    country: "CA",
  };

  const { error } = await service
    .from("profiles")
    .update({
      name: fullName || null,
      phone: input.phone.trim() || null,
      addresses: asJson([address]),
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  return { ok: true };
}

export interface PlaceOrderInput {
  designId: string;
  /** Pickup at the shop vs ship to the saved address (both free). */
  fulfillment: "ship" | "pickup";
  /** A customer preference, not a hard fee — Julian confirms timing on the proof. */
  turnaround: "standard" | "rush";
}

/**
 * The end of the checkout funnel: turns the saved design + the profile's
 * contact/address into a real Order (this is where the DH-2026-xxxx number is
 * finally assigned). Tax is computed from the saved province; shipping is free
 * for now. No payment is taken — the order lands as submitted/unpaid for Julian
 * to review and proof.
 */
export async function placeOrderAction(
  input: PlaceOrderInput
): Promise<{ orderId?: string; orderNumber?: string; needsLogin?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { needsLogin: true };
  const service = requireSupabaseServiceClient();

  const { data: design } = await service
    .from("designs")
    .select("id, name, product_id, colour, size_quantities, price_snapshot, decoration_method_id")
    .eq("id", input.designId)
    .eq("customer_id", user.id)
    .single();
  if (!design) return { error: "Design not found." };

  const { data: profile } = await service
    .from("profiles")
    .select("addresses")
    .eq("id", user.id)
    .single();
  const address = (((profile?.addresses ?? []) as StoredAddress[])[0] ?? null) as StoredAddress | null;
  if (!address?.street) return { error: "Add your contact details first." };

  const snap = (design.price_snapshot ?? {}) as StoredSnapshot;
  const subtotal = Number(snap.subtotal ?? 0);
  const setup = Number(snap.setupTotal ?? 0);
  const province = isProvinceCode(address.prov) ? address.prov : null;
  const tax = calcTax(subtotal + setup, province).total;
  const shipping = 0;
  const total = subtotal + setup + shipping + tax;

  const { data: product } = design.product_id
    ? await service.from("products").select("name, lead_time_days").eq("id", design.product_id).single()
    : { data: null };
  const lead = product?.lead_time_days ?? 7;
  const due = new Date();
  due.setDate(due.getDate() + lead);

  const notes: { at: string; actor: string; text: string }[] = [];
  if (input.turnaround === "rush") {
    notes.push({
      at: new Date().toISOString(),
      actor: "customer",
      text: "Requested rush / ASAP turnaround — please confirm timing and any rush fee.",
    });
  }

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert({
      customer_id: user.id,
      status: "submitted",
      payment_status: "unpaid",
      pricing: asJson({ subtotal, setupFees: setup, shipping, tax, total }),
      due_date: due.toISOString().slice(0, 10),
      fulfillment_method: input.fulfillment,
      shipping_method: input.turnaround,
      shipping_address: input.fulfillment === "ship" ? asJson(address) : null,
      customer_notes: asJson(notes),
    })
    .select("id, order_number")
    .single();
  if (orderErr) return { error: orderErr.message };

  const { error: liErr } = await service.from("line_items").insert({
    order_id: order.id,
    product_id: design.product_id,
    design_id: design.id,
    product_name: product?.name ?? null,
    colour: design.colour,
    size_quantities: design.size_quantities,
    decoration_method_id: design.decoration_method_id,
    unit_price: Number(snap.unitPrice ?? 0),
    setup_fee: setup,
    line_total: Number(snap.total ?? subtotal + setup),
  });
  if (liErr) return { error: liErr.message };

  // The design was a draft until the order was placed.
  await service.from("designs").update({ status: "submitted" }).eq("id", design.id).eq("customer_id", user.id);

  await service.from("order_activity").insert({
    order_id: order.id,
    actor_id: user.id,
    actor_name: "Customer",
    type: "order_created",
    detail: asJson({ via: "checkout", fulfillment: input.fulfillment, turnaround: input.turnaround }),
  });

  return { orderId: order.id, orderNumber: order.order_number ?? undefined };
}
