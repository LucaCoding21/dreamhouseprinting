"use server";

import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { calcTax, isProvinceCode } from "@/lib/pricing/tax";
import { roundCents, formatCAD } from "@/lib/money";
import { sendOrderStatusEmail, notifyJulian } from "@/lib/notify";
import { calcPrice } from "@/lib/pricing/platform";
import { rushFee } from "@/lib/pricing/rush";
import { rushTierFee } from "@/lib/pricing/decorationPricing";
import {
  curveForProduct,
  priceFromCurve,
  allowedCurveDecorations,
  decorationForMethodSlug,
  defaultDecoration,
} from "@/lib/pricing/quote";
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
  /** Colour count the designer priced with (provisional; artist confirms). */
  inkColours?: number;
  /** Rush request. New designs store the chosen tier; designs saved before rush
   *  tiers existed carry the legacy flat-rush boolean. */
  rush?: boolean | { days?: number; pct?: number; fee?: number } | null;
  /** Requested in-hand date (YYYY-MM-DD) from the designer's "Pick a date". */
  neededBy?: string | null;
  /** Free-text note the customer left in the designer. */
  customerNote?: string | null;
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
 * the designer derived, real measured print size + colour count, so the
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
 * the profile, abandoning here leaves no half-built order behind.
 */
export async function saveContactAction(
  input: CheckoutContactInput
): Promise<{ ok?: boolean; error?: string }> {
  const auth = await resolveCheckoutAuth(input.designId);
  if (!auth) return { error: "We couldn’t find your design, please start over." };
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
  /**
   * Legacy per-design checkout funnel only. The rush ask now lives in the
   * designer and travels in the design's price snapshot, so the cart no longer
   * sends this. "rush" here still means "requested, fee quoted on the proof".
   */
  turnaround?: "standard" | "rush";
  /** Customer's requested in-hand date (YYYY-MM-DD), only on a rush. */
  neededBy?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The end of the checkout funnel: turns the saved design + the profile's
 * contact/address into a real Order (this is where the order number, a plain
 * 1000+ integer, is finally assigned by a DB trigger). Tax is computed from the saved province; shipping is free
 * for now. No payment is taken, the order lands as submitted/unpaid for Julian
 * to review and proof.
 */
export async function placeOrderAction(
  input: PlaceOrderInput
): Promise<{ orderId?: string; orderNumber?: string; publicToken?: string; isGuest?: boolean; error?: string }> {
  const auth = await resolveCheckoutAuth(input.designId);
  if (!auth) return { error: "We couldn’t find your design, please start over." };
  const service = requireSupabaseServiceClient();

  const { data: design } = await service
    .from("designs")
    .select("id, name, status, product_id, colour, colorways, size_quantities, price_snapshot, decoration_method_id, guest_contact")
    .eq("id", input.designId)
    .single();
  if (!design) return { error: "Design not found." };

  // Idempotency: the design flips to "submitted" once its order exists. A
  // back-button resubmit or a cart retry must not create a second order (and a
  // second batch of emails). Return the order already placed for this design.
  if (design.status === "submitted") {
    const { data: priorLine } = await service
      .from("line_items")
      .select("order_id")
      .eq("design_id", design.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorLine?.order_id) {
      const { data: priorOrder } = await service
        .from("orders")
        .select("id, order_number, public_token")
        .eq("id", priorLine.order_id)
        .maybeSingle();
      if (priorOrder) {
        return {
          orderId: priorOrder.id,
          orderNumber: priorOrder.order_number ?? undefined,
          publicToken: priorOrder.public_token ?? undefined,
          isGuest: auth.isGuest,
        };
      }
    }
  }

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

  // The snapshot the designer wrote is the customer-facing estimate + print
  // spec ONLY. The money actually charged (approve-and-pay bills pricing.total)
  // is rebuilt here from the product's authoritative pricing rules, so a
  // tampered save cannot place a real job at a fake price.
  const snap = (design.price_snapshot ?? {}) as StoredSnapshot;

  // One line item per garment colourway. Built up front because the combined
  // quantity across colourways is what the quantity-break curve prices against.
  const rawColorways = (design.colorways ?? []) as StoredColorway[];
  const legacySizes = (design.size_quantities ?? {}) as Record<string, number>;
  const legacyColour = (design.colour ?? {}) as { name?: string; hex?: string | null };
  const cwQuantity = (cw: StoredColorway) => {
    const fromSizes = Object.values(cw.sizeQuantities ?? {}).reduce(
      (s, n) => s + (Number(n) > 0 ? Number(n) : 0),
      0
    );
    return fromSizes > 0 ? fromSizes : Math.max(0, Number(cw.quantity ?? 0));
  };
  const colorways: StoredColorway[] = rawColorways.length
    ? rawColorways
    : [
        {
          colourName: legacyColour.name,
          colourHex: legacyColour.hex ?? null,
          sizeQuantities: legacySizes,
          quantity: Object.values(legacySizes).reduce((s, n) => s + (Number(n) > 0 ? Number(n) : 0), 0),
        },
      ];
  const colourwayQtys = colorways.map(cwQuantity);
  const combinedQty = colourwayQtys.reduce((s, n) => s + n, 0);

  // Product pricing inputs + the design's decoration method (and the product's
  // allowed methods, for the curve-decoration fallback below).
  const { data: product } = design.product_id
    ? await service
        .from("products")
        .select(
          "name, lead_time_days, wholesale_cost, base_price, markup_type, markup_value, pricing_rules, allowed_decoration_method_ids"
        )
        .eq("id", design.product_id)
        .single()
    : { data: null };

  const methodIds = [
    ...(design.decoration_method_id ? [design.decoration_method_id] : []),
    ...((product?.allowed_decoration_method_ids ?? []) as string[]),
  ];
  const { data: methods } = methodIds.length
    ? await service
        .from("decoration_methods")
        .select("id, slug, setup_fee, per_unit_cost, per_color_cost")
        .in("id", methodIds)
    : {
        data: [] as {
          id: string;
          slug: string;
          setup_fee: number;
          per_unit_cost: number;
          per_color_cost: number;
        }[],
      };
  const selectedMethod = methods?.find((m) => m.id === design.decoration_method_id) ?? null;
  const allowedSlugs = ((product?.allowed_decoration_method_ids ?? []) as string[])
    .map((id) => methods?.find((m) => m.id === id)?.slug)
    .filter((s): s is string => !!s);

  // Colour count + location count the designer priced with. Both are provisional
  // (the artist confirms the real screen count at proofing and nothing is
  // charged before the invoice), so we mirror the designer and trust them here.
  const inkColours = Math.max(1, Number(snap.inkColours ?? 1) || 1);
  const locations = Math.max(
    1,
    (snap.decorationSpots ?? []).filter((s) => s.location || s.view).length || 1
  );
  const qty = Math.max(combinedQty, 1);

  // Recompute the per-unit price exactly the way the designer's `jobPrice` does:
  // the product's all-inclusive customer curve when it has one and the method
  // maps onto it (curve jobs carry no separate setup), else the cost-plus
  // platform engine off server-loaded wholesale/markup.
  const productPricing = product
    ? {
        wholesale_cost: product.wholesale_cost,
        base_price: product.base_price,
        markup_type: product.markup_type,
        markup_value: product.markup_value,
        pricing_rules: product.pricing_rules,
      }
    : null;

  let unitPrice = 0;
  let setup = 0;
  if (productPricing) {
    const curve = curveForProduct(productPricing);
    let decoration = decorationForMethodSlug(selectedMethod?.slug);
    let pricedFromCurve = false;
    if (curve) {
      // The designer only offers curve-priceable methods; if the stored method
      // cannot price on the curve, fall back to the first allowed curve
      // decoration (matching allowedCurveDecorations / priceableMethods[0]).
      if (!decoration || !(curve.breaks[decoration]?.length)) {
        const allowed = allowedCurveDecorations(curve, allowedSlugs.length ? allowedSlugs : null);
        decoration = allowed[0] ?? defaultDecoration(curve);
      }
      const r = priceFromCurve(curve, { qty, colours: inkColours, locations, decoration });
      if (r.available) {
        unitPrice = roundCents(r.perUnit);
        setup = 0;
        pricedFromCurve = true;
      }
    }
    if (!pricedFromCurve) {
      const p = calcPrice({
        product: productPricing,
        method: selectedMethod,
        quantity: qty,
        colourCount: inkColours,
        locationCount: locations,
      });
      unitPrice = p.unitPrice;
      setup = p.setupTotal;
    }
  } else {
    // No product to reprice against (product deleted): the stored estimate is
    // the best available basis.
    unitPrice = Number(snap.unitPrice ?? 0);
    setup = Number(snap.setupTotal ?? 0);
  }

  // Combined-quantity per-unit price applied to each colourway's own quantity,
  // matching the designer's grand subtotal (round per line, then sum).
  const subtotal = roundCents(
    colourwayQtys.reduce((s, q) => s + roundCents(unitPrice * q), 0)
  );

  // Flag when the trustworthy server number departs from the client estimate by
  // more than a rounding cent so admin can see the estimate was superseded.
  const snapBasis = Number(snap.subtotal ?? 0) + Number(snap.setupTotal ?? 0);
  const serverRepriced = Math.abs(subtotal + setup - snapBasis) > 0.05;

  // Rush. The designer's "I just want it sooner" tiers carry a real percentage
  // surcharge, recomputed here off the SERVER subtotal (never the client's fee)
  // so a tampered snapshot can only change which tier was asked for, not the
  // math. A bare requested date adds nothing, the shop quotes that on the proof.
  // Designs saved before rush tiers existed carry the legacy flat-rush boolean,
  // still honoured at the old 50% rate.
  const snapRush = snap.rush ?? null;
  const rushTier =
    snapRush && typeof snapRush === "object" && Number(snapRush.pct) > 0
      ? { days: Math.max(0, Math.round(Number(snapRush.days) || 0)), pct: Number(snapRush.pct) }
      : null;
  const rush = rushTier
    ? rushTierFee(subtotal, setup, rushTier.pct)
    : rushFee(subtotal, setup, snapRush === true);
  const province = isProvinceCode(address.prov) ? address.prov : null;
  const tax = calcTax(subtotal + setup + rush, province).total;
  const shipping = 0;
  const total = roundCents(subtotal + setup + rush + shipping + tax);

  const lead = product?.lead_time_days ?? 7;
  const due = new Date();
  due.setDate(due.getDate() + lead);

  // The customer's picked need-by date IS the order's target date, so it drives
  // due_date (falling back to the lead-time projection). It can come from the
  // designer (price snapshot) or the legacy funnel's rush step. Only trust a
  // well-formed YYYY-MM-DD so a tampered request can't write garbage.
  const neededBy = ISO_DATE.test(input.neededBy ?? "")
    ? input.neededBy!
    : ISO_DATE.test(snap.neededBy ?? "")
      ? snap.neededBy!
      : null;
  const rushRequested = input.turnaround === "rush" || !!rushTier || !!neededBy;
  const dueDate = neededBy ?? due.toISOString().slice(0, 10);

  const notes: { at: string; actor: string; text: string }[] = [];
  if (rushRequested) {
    // Rendered where notes use whitespace-pre-wrap, so the newline bullets
    // display as a scannable list rather than a run-on sentence.
    const lines = [
      rushTier
        ? `Rush requested: ${rushTier.days} business days (+${rushTier.pct}%, ${formatCAD(rush)})`
        : "Rush turnaround requested:",
      neededBy ? `• Needs it by ${neededBy}` : null,
      "• Confirm the timeline",
      rushTier ? null : "• Quote the rush fee",
    ].filter(Boolean);
    notes.push({ at: new Date().toISOString(), actor: "customer", text: lines.join("\n") });
  }

  // The customer's own note travels to each line's customerNotes (the one
  // per-line note field staff label "Customer notes" and the customer sees
  // echoed on their order page). Old orders carried it at
  // orders.production_notes.customer; the serializer still falls back there.
  const customerNote = (snap.customerNote ?? "").trim();

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert({
      customer_id: auth.userId,
      guest_email: guestEmail,
      status: "submitted",
      payment_status: "unpaid",
      pricing: asJson({
        subtotal,
        setupFees: setup,
        rush,
        shipping,
        tax,
        total,
        ...(serverRepriced ? { serverRepriced: true } : {}),
      }),
      due_date: dueDate,
      fulfillment_method: input.fulfillment,
      shipping_method: rushRequested ? "rush" : "standard",
      shipping_address: input.fulfillment === "ship" ? asJson(address) : null,
      customer_notes: asJson(notes),
    })
    .select("id, order_number, public_token")
    .single();
  if (orderErr) return { error: orderErr.message };

  // Same artwork on every colourway, so every line gets the same server-priced
  // unit + the same pre-filled decoration spec (measured size + colour count
  // from the designer). Setup is a single shared fee on the first line so the
  // line totals sum to the order's subtotal + setup.
  const baseDecorations = decorationsFromSnapshot(snap);
  const decorations = customerNote
    ? { ...(baseDecorations ?? { spots: [] }), customerNotes: customerNote }
    : baseDecorations;
  const lineRows = colorways.map((cw, i) => ({
    order_id: order.id,
    product_id: design.product_id,
    design_id: design.id,
    product_name: product?.name ?? null,
    colour: asJson({ name: cw.colourName ?? null, hex: cw.colourHex ?? null }),
    size_quantities: asJson(cw.sizeQuantities ?? {}),
    decoration_method_id: design.decoration_method_id,
    unit_price: unitPrice,
    setup_fee: i === 0 ? setup : 0,
    line_total: roundCents(roundCents(unitPrice * colourwayQtys[i]) + (i === 0 ? setup : 0)),
    ...(decorations ? { decorations: asJson(decorations) } : {}),
  }));
  const { error: liErr } = await service.from("line_items").insert(lineRows);
  if (liErr) {
    // Roll back the just-created order (and any activity) so a failed line
    // insert can't leave a headless submitted order with no items behind.
    await service.from("order_activity").delete().eq("order_id", order.id);
    await service.from("orders").delete().eq("id", order.id);
    return { error: liErr.message };
  }

  // The design was a draft until the order was placed.
  const statusUpdate = service.from("designs").update({ status: "submitted" }).eq("id", design.id);
  await (auth.isGuest ? statusUpdate.eq("guest_token", auth.guestToken!) : statusUpdate.eq("customer_id", auth.userId!));

  await service.from("order_activity").insert({
    order_id: order.id,
    actor_id: auth.userId,
    actor_name: "Customer",
    type: "order_created",
    detail: asJson({
      via: "checkout",
      fulfillment: input.fulfillment,
      turnaround: rushRequested ? "rush" : "standard",
      rushTier,
      neededBy,
      guest: auth.isGuest,
    }),
  });

  // Confirmation emails, the done page tells the customer to watch their
  // inbox, and Julian needs to hear about new orders without polling /admin.
  // Never fail the placed order over mail.
  try {
    await sendOrderStatusEmail(order.id, "submitted");
    await notifyJulian(
      `New order ${order.order_number ?? order.id}, ${formatCAD(total)}`,
      [
        `${address?.name || "A customer"} placed ${order.order_number ?? "an order"} for ${formatCAD(total)}.`,
        rushTier
          ? `RUSH: ${rushTier.days} business days, +${rushTier.pct}% (${formatCAD(rush)}) already on the total${neededBy ? `, needed by ${neededBy}` : ""}. Confirm the timeline.`
          : rushRequested
            ? `RUSH turnaround requested${neededBy ? `, needed by ${neededBy}` : ""}. Confirm timeline and quote the fee.`
            : null,
        customerNote ? `Customer note: ${customerNote}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
      { orderId: order.id, kicker: "New order", tone: "purple", amountLabel: "Order total" }
    );
  } catch (e) {
    console.error("[checkout] order confirmation emails failed", e);
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number ?? undefined,
    publicToken: order.public_token ?? undefined,
    isGuest: auth.isGuest,
  };
}
