"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, getProfile } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { sendOrderStatusEmail } from "@/lib/notify";
import { roundCents } from "@/lib/money";
import { rushFee } from "@/lib/pricing/rush";
import type { Json } from "@/lib/db/types";
import type { OrderStatus } from "@/lib/db/rows";
import { MANUAL_ORDER_STATUSES, type CustomerHit, type ManualOrderInput } from "./shared";

const asJson = (v: unknown) => v as unknown as Json;

/**
 * Type-ahead lookup for the "existing customer" picker. Gated on orders.edit
 * (the same permission the rest of this flow needs) so a staff member who can
 * write orders can always find the person the order is for.
 */
export async function searchCustomersAction(
  query: string
): Promise<{ customers?: CustomerHit[]; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();

  // PostgREST's `or` filter is comma/paren delimited, so those characters (plus
  // the wildcards) have to come out of the raw input before it is interpolated.
  const q = query.replace(/[,()%*\\]/g, " ").trim();
  if (q.length < 2) return { customers: [] };

  const { data, error } = await service
    .from("profiles")
    .select("id, name, email, phone, addresses")
    .eq("role", "customer")
    .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
    .order("name")
    .limit(10);
  if (error) return { error: error.message };

  const customers: CustomerHit[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    address: (((p.addresses ?? []) as CustomerHit["address"][])[0] ?? null) as CustomerHit["address"],
  }));
  return { customers };
}

const sumSizes = (sq: Record<string, number>) =>
  Object.values(sq).reduce((a, b) => a + (Number(b) > 0 ? Number(b) : 0), 0);

const money = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);

/** Clean a size map down to whole positive quantities. */
function cleanSizes(sq: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [size, qty] of Object.entries(sq ?? {})) {
    const key = size.trim();
    const n = Math.floor(Number(qty));
    if (key && Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

/**
 * Create an order that never came through the website: Julian took it by phone,
 * DM or over the counter. Mirrors the checkout's placeOrderAction (same order
 * row shape, same pricing jsonb, same line_items + activity), minus the design
 * funnel: items are picked straight from the catalog or typed in freeform, and
 * the price is suggested from the product curve but staff-editable.
 *
 * Order numbers and the public /o/{token} link are both assigned by the
 * database on insert (an assign_order_number trigger and a random default on
 * public_token), exactly as they are for a customer order.
 */
export async function createManualOrderAction(
  input: ManualOrderInput
): Promise<{ orderId?: string; orderNumber?: string; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const profile = await getProfile();

  // ---- Customer -----------------------------------------------------------
  let customerId: string | null = null;
  let guestEmail: string | null = null;
  let contactName = input.address.name?.trim() ?? "";
  let contactPhone = input.address.phone?.trim() ?? "";

  if (input.customerId) {
    const { data: customer } = await service
      .from("profiles")
      .select("id, name, phone")
      .eq("id", input.customerId)
      .maybeSingle();
    if (!customer) return { error: "That customer account no longer exists." };
    customerId = customer.id;
    contactName = contactName || customer.name || "";
    contactPhone = contactPhone || customer.phone || "";
  } else {
    const name = input.guest?.name?.trim() ?? "";
    const email = input.guest?.email?.trim() ?? "";
    if (!name) return { error: "Add the customer's name." };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { error: "Add a valid customer email, it's where the order updates go." };
    }
    guestEmail = email;
    contactName = contactName || name;
    contactPhone = contactPhone || input.guest?.phone?.trim() || "";
  }

  // ---- Items --------------------------------------------------------------
  const items = (input.items ?? [])
    .map((it) => ({ ...it, sizeQuantities: cleanSizes(it.sizeQuantities) }))
    .filter((it) => sumSizes(it.sizeQuantities) > 0);
  if (items.length === 0) return { error: "Add at least one item with a quantity." };
  for (const it of items) {
    if (!it.productName.trim()) return { error: "Every item needs a name or description." };
    if (money(it.unitPrice) === null) return { error: "Item prices must be zero or greater." };
  }

  // ---- Money (recomputed server-side, never trusted from the form) --------
  const shipping = money(input.shipping);
  const tax = money(input.tax);
  if (shipping === null || tax === null) return { error: "Shipping and tax must be zero or greater." };

  const subtotal = roundCents(
    items.reduce((sum, it) => sum + roundCents(it.unitPrice * sumSizes(it.sizeQuantities)), 0)
  );
  // Curve prices are all-inclusive, so a manual order carries no setup line.
  const setupFees = 0;
  const rush = rushFee(subtotal, setupFees, input.rush);
  const total = roundCents(subtotal + setupFees + rush + shipping + tax);

  // ---- Order row ----------------------------------------------------------
  const status: OrderStatus = MANUAL_ORDER_STATUSES.some((s) => s.value === input.status)
    ? input.status
    : "submitted";
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate ?? "") ? input.dueDate : null;

  // Written on pickup orders too: it is the only place a guest's name and phone
  // live, and the admin contact card reads them from here.
  const address = {
    name: contactName,
    company: input.address.company?.trim() || null,
    phone: contactPhone,
    street: input.address.street?.trim() ?? "",
    city: input.address.city?.trim() ?? "",
    prov: input.address.prov ?? "",
    postal: input.address.postal?.trim().toUpperCase() ?? "",
    country: "CA",
  };
  if (input.fulfillment === "ship" && !address.street) {
    return { error: "Add a shipping address, or switch this order to pickup." };
  }

  const note = input.customerNote.trim();
  const notes = note
    ? [{ at: new Date().toISOString(), actor: profile?.name ?? "Staff", text: note }]
    : [];

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert({
      customer_id: customerId,
      guest_email: guestEmail,
      status,
      payment_status: "unpaid",
      pricing: asJson({
        subtotal,
        setupFees,
        rush,
        addons: 0,
        shipping,
        tax,
        discount: 0,
        total,
      }),
      due_date: dueDate,
      fulfillment_method: input.fulfillment,
      shipping_method: input.rush ? "rush" : "standard",
      shipping_address: asJson(address),
      customer_notes: asJson(notes),
      sales_rep: profile?.name ?? null,
    })
    .select("id, order_number")
    .single();
  if (orderErr) return { error: orderErr.message };

  // ---- Line items ---------------------------------------------------------
  const lineRows = items.map((it) => {
    const qty = sumSizes(it.sizeQuantities);
    const locations = Math.max(1, Math.min(Math.floor(it.printLocations) || 1, 4));
    const colours = Math.max(1, Math.min(Math.floor(it.printColours) || 1, 8));
    // Start the artist's decoration sheet from what the price was quoted on.
    // Location names are left blank on purpose: nobody has picked placements yet.
    const spots = Array.from({ length: locations }, () => ({
      location: "",
      type: "",
      widthIn: "",
      heightIn: "",
      colours: String(colours),
      pantones: [] as string[],
      puff: false,
      spotProcess: false,
    }));
    return {
      order_id: order.id,
      product_id: it.kind === "catalog" ? it.productId : null,
      product_name: it.productName.trim(),
      colour: asJson({ name: it.colourName || null, hex: it.colourHex || null }),
      size_quantities: asJson(it.sizeQuantities),
      decoration_method_id: it.kind === "catalog" ? it.decorationMethodId : null,
      decorations: asJson({ spots, bagging: false, sewnTags: false, priceConfirmed: false }),
      unit_price: it.unitPrice,
      setup_fee: 0,
      line_total: roundCents(it.unitPrice * qty),
    };
  });

  const { error: liErr } = await service.from("line_items").insert(lineRows);
  if (liErr) {
    // Never leave a headless order behind when the items fail to write.
    await service.from("order_activity").delete().eq("order_id", order.id);
    await service.from("orders").delete().eq("id", order.id);
    return { error: liErr.message };
  }

  await service.from("order_activity").insert({
    order_id: order.id,
    actor_id: profile?.id ?? null,
    actor_name: profile?.name ?? "Staff",
    type: "order_created",
    detail: asJson({
      via: "admin_manual",
      note: "Order created manually by staff",
      status,
      total,
      items: lineRows.length,
      guest: !customerId,
    }),
  });

  // Optional, and off by default: a phone order is usually confirmed on the
  // phone. Never fail the created order over mail.
  if (input.sendConfirmation) {
    try {
      await sendOrderStatusEmail(order.id, "submitted");
    } catch (e) {
      console.error("[admin] manual order confirmation email failed", e);
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { orderId: order.id, orderNumber: order.order_number ?? undefined };
}
