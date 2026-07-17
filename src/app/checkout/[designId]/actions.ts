"use server";

import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { calcTax, isProvinceCode } from "@/lib/pricing/tax";
import { roundCents, formatCAD } from "@/lib/money";
import { sendOrderStatusEmail, notifyJulian } from "@/lib/notify";
import { resolveCheckoutAuth } from "./context";
import type { Json } from "@/lib/db/types";

const asJson = (v: unknown) => v as unknown as Json;

interface GuestContact {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  street?: string;
  city?: string;
  province?: string;
  postal?: string;
}

interface StoredColorway {
  colourName?: string;
  colourHex?: string | null;
  sizeQuantities?: Record<string, number>;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
}

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
  decorationSpots?: {
    view?: string;
    location?: string;
    type?: string;
    widthIn?: string;
    heightIn?: string;
    colours?: string;
  }[];
}

/**
 * Pre-fill the admin decoration sheet (line_items.decorations) from the spec
 * the designer derived — real measured print size + colour count — so the
 * artist starts from real values instead of blanks. Returns null when the
 * design predates the spec (the sheet then starts empty, as before).
 */
function decorationsFromSnapshot(snap: StoredSnapshot) {
  const spots = (snap.decorationSpots ?? [])
    .filter((s) => s.location || s.view)
    .map((s) => ({
      location: s.location || s.view || "",
      type: s.type ?? "",
      widthIn: s.widthIn ?? "",
      heightIn: s.heightIn ?? "",
      colours: s.colours ?? "",
      pantones: [] as string[],
      puff: false,
      spotProcess: false,
    }));
  if (spots.length === 0) return null;
  return { spots, bagging: false, sewnTags: false, priceConfirmed: false };
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
): Promise<{ ok?: boolean; error?: string }> {
  const auth = await resolveCheckoutAuth(input.designId);
  if (!auth) return { error: "We couldn’t find your design — please start over." };
  const service = requireSupabaseServiceClient();

  const fullName = `${input.firstName} ${input.lastName}`.replace(/\s+/g, " ").trim();

  if (auth.isGuest) {
    // Guests have no profile, so their contact + address lives on the design.
    const { error } = await service
      .from("designs")
      .update({
        guest_contact: asJson({
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email: input.email.trim(),
          phone: input.phone.trim(),
          company: input.company?.trim() || "",
          street: input.street.trim(),
          city: input.city.trim(),
          province: input.province,
          postal: input.postal.trim().toUpperCase(),
        }),
        lead_email: input.email.trim() || null,
      })
      .eq("id", input.designId)
      .eq("guest_token", auth.guestToken!);
    if (error) return { error: error.message };
    return { ok: true };
  }

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
    .eq("id", auth.userId!);
  if (error) return { error: error.message };

  return { ok: true };
}

export interface PlaceOrderInput {
  designId: string;
  /** Pickup at the shop vs ship to the saved address (both free). */
  fulfillment: "ship" | "pickup";
  /** A customer preference, not a hard fee — Julian confirms timing on the proof. */
  turnaround: "standard" | "rush";
  /** Customer's requested in-hand date (YYYY-MM-DD), only on a rush. */
  neededBy?: string | null;
}

/**
 * The end of the checkout funnel: turns the saved design + the profile's
 * contact/address into a real Order (this is where the order number, a plain
 * 1000+ integer, is finally assigned by a DB trigger). Tax is computed from the saved province; shipping is free
 * for now. No payment is taken — the order lands as submitted/unpaid for Julian
 * to review and proof.
 */
export async function placeOrderAction(
  input: PlaceOrderInput
): Promise<{ orderId?: string; orderNumber?: string; isGuest?: boolean; error?: string }> {
  const auth = await resolveCheckoutAuth(input.designId);
  if (!auth) return { error: "We couldn’t find your design — please start over." };
  const service = requireSupabaseServiceClient();

  const { data: design } = await service
    .from("designs")
    .select("id, name, product_id, colour, colorways, size_quantities, price_snapshot, decoration_method_id, guest_contact")
    .eq("id", input.designId)
    .single();
  if (!design) return { error: "Design not found." };

  // Contact + shipping address: the profile for logged-in customers, the
  // design's guest_contact for guests (who have no profile).
  let address: StoredAddress | null;
  let guestEmail: string | null = null;
  if (auth.isGuest) {
    const gc = (design.guest_contact ?? {}) as GuestContact;
    const fullName = `${gc.firstName ?? ""} ${gc.lastName ?? ""}`.replace(/\s+/g, " ").trim();
    guestEmail = gc.email?.trim() || null;
    address = gc.street
      ? {
          name: fullName,
          company: gc.company || null,
          phone: gc.phone || "",
          street: gc.street,
          city: gc.city || "",
          prov: gc.province || "",
          postal: gc.postal || "",
          country: "CA",
        }
      : null;
  } else {
    const { data: profile } = await service.from("profiles").select("addresses").eq("id", auth.userId!).single();
    address = (((profile?.addresses ?? []) as StoredAddress[])[0] ?? null) as StoredAddress | null;
  }
  if (!address?.street) return { error: "Add your contact details first." };

  const snap = (design.price_snapshot ?? {}) as StoredSnapshot;
  const subtotal = Number(snap.subtotal ?? 0);
  const setup = Number(snap.setupTotal ?? 0);
  // Rush is a request, not a fixed surcharge — the shop quotes the real fee when
  // they confirm the order, so nothing is added to the customer's total here.
  const rush = 0;
  const province = isProvinceCode(address.prov) ? address.prov : null;
  const tax = calcTax(subtotal + setup, province).total;
  const shipping = 0;
  const total = roundCents(subtotal + setup + shipping + tax);

  const { data: product } = design.product_id
    ? await service.from("products").select("name, lead_time_days").eq("id", design.product_id).single()
    : { data: null };
  const lead = product?.lead_time_days ?? 7;
  const due = new Date();
  due.setDate(due.getDate() + lead);

  // On a rush, the customer's picked need-by date IS the order's target date, so
  // it drives due_date (falling back to the lead-time projection). Only trust a
  // well-formed YYYY-MM-DD so a tampered request can't write garbage.
  const neededBy =
    input.turnaround === "rush" && /^\d{4}-\d{2}-\d{2}$/.test(input.neededBy ?? "") ? input.neededBy! : null;
  const dueDate = neededBy ?? due.toISOString().slice(0, 10);

  const notes: { at: string; actor: string; text: string }[] = [];
  if (input.turnaround === "rush") {
    notes.push({
      at: new Date().toISOString(),
      actor: "customer",
      text: neededBy
        ? `Rush turnaround requested — customer needs it by ${neededBy}. Confirm timeline and quote the rush fee.`
        : "Rush turnaround requested — confirm timeline and quote the rush fee.",
    });
  }

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert({
      customer_id: auth.userId,
      guest_email: guestEmail,
      status: "submitted",
      payment_status: "unpaid",
      pricing: asJson({ subtotal, setupFees: setup, rush, shipping, tax, total }),
      due_date: dueDate,
      fulfillment_method: input.fulfillment,
      shipping_method: input.turnaround,
      shipping_address: input.fulfillment === "ship" ? asJson(address) : null,
      customer_notes: asJson(notes),
    })
    .select("id, order_number")
    .single();
  if (orderErr) return { error: orderErr.message };

  // One line item per garment colourway. Setup is a single shared fee, placed on
  // the first line so the line totals sum to the order's subtotal + setup.
  const rawColorways = (design.colorways ?? []) as StoredColorway[];
  const legacySizes = (design.size_quantities ?? {}) as Record<string, number>;
  const legacyColour = (design.colour ?? {}) as { name?: string; hex?: string | null };
  const colorways: StoredColorway[] = rawColorways.length
    ? rawColorways
    : [
        {
          colourName: legacyColour.name,
          colourHex: legacyColour.hex ?? null,
          sizeQuantities: legacySizes,
          quantity: Object.values(legacySizes).reduce((s, n) => s + (Number(n) > 0 ? Number(n) : 0), 0),
          unitPrice: Number(snap.unitPrice ?? 0),
          lineTotal: Number(snap.subtotal ?? subtotal),
        },
      ];

  // Same artwork on every colourway, so every line gets the same pre-filled
  // decoration spec (measured size + colour count from the designer).
  const decorations = decorationsFromSnapshot(snap);
  const lineRows = colorways.map((cw, i) => ({
    order_id: order.id,
    product_id: design.product_id,
    design_id: design.id,
    product_name: product?.name ?? null,
    colour: asJson({ name: cw.colourName ?? null, hex: cw.colourHex ?? null }),
    size_quantities: asJson(cw.sizeQuantities ?? {}),
    decoration_method_id: design.decoration_method_id,
    unit_price: Number(cw.unitPrice ?? 0),
    setup_fee: i === 0 ? setup : 0,
    line_total: roundCents(Number(cw.lineTotal ?? 0) + (i === 0 ? setup : 0)),
    ...(decorations ? { decorations: asJson(decorations) } : {}),
  }));
  const { error: liErr } = await service.from("line_items").insert(lineRows);
  if (liErr) return { error: liErr.message };

  // The design was a draft until the order was placed.
  const statusUpdate = service.from("designs").update({ status: "submitted" }).eq("id", design.id);
  await (auth.isGuest ? statusUpdate.eq("guest_token", auth.guestToken!) : statusUpdate.eq("customer_id", auth.userId!));

  await service.from("order_activity").insert({
    order_id: order.id,
    actor_id: auth.userId,
    actor_name: "Customer",
    type: "order_created",
    detail: asJson({ via: "checkout", fulfillment: input.fulfillment, turnaround: input.turnaround, neededBy, guest: auth.isGuest }),
  });

  // Confirmation emails — the done page tells the customer to watch their
  // inbox, and Julian needs to hear about new orders without polling /admin.
  // Never fail the placed order over mail.
  try {
    await sendOrderStatusEmail(order.id, "submitted");
    await notifyJulian(
      `New order ${order.order_number ?? order.id} — ${formatCAD(total)}`,
      [
        `${address?.name || "A customer"} placed ${order.order_number ?? "an order"} for ${formatCAD(total)}.`,
        input.turnaround === "rush"
          ? `RUSH turnaround requested${neededBy ? ` — needed by ${neededBy}` : ""}. Confirm timeline and quote the fee.`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
      { orderId: order.id, kicker: "New order", tone: "purple", amountLabel: "Order total" }
    );
  } catch (e) {
    console.error("[checkout] order confirmation emails failed", e);
  }

  return { orderId: order.id, orderNumber: order.order_number ?? undefined, isGuest: auth.isGuest };
}
