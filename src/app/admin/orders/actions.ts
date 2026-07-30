"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, getProfile, hasPermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { sendOrderStatusEmail, sendOrderEmail, sendOrderCommentEmail } from "@/lib/notify";
import { ensureCheckoutSession, expireOpenCheckoutSession, markOrderPaid } from "@/lib/orders/payments";
import type { Json, Database } from "@/lib/db/types";
import type {
  OrderStatus,
  PaymentStatus,
  ProductionNotesJson,
  ProductColourJson,
  ProductQuoteCurveJson,
  QuoteDecoration,
} from "@/lib/db/rows";
import { priceFromCurve, defaultDecoration } from "@/lib/pricing/quote";
import type { LineProductionStatus } from "@/lib/lineProduction";
import { mergeAddonSettings, lineAddonTotal } from "@/lib/addonSettings";
import { resolveDiscount, type DiscountType } from "@/lib/pricing/discount";
import { calcTax } from "@/lib/pricing/tax";
import { isBackwardStatus } from "@/lib/orderStatus";
import {
  adjustmentsTotal,
  cleanAdjustments,
  normalizeAdjustments,
  orderTotal,
  resolveTaxProvince,
  taxableBase,
  type PriceAdjustment,
} from "@/lib/orders/pricingMath";

type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];
const asJson = (v: unknown) => v as unknown as Json;
const YEAR = 60 * 60 * 24 * 365;

async function logActivity(
  service: ReturnType<typeof requireSupabaseServiceClient>,
  orderId: string,
  type: string,
  detail: Record<string, unknown>
) {
  const profile = await getProfile();
  await service.from("order_activity").insert({
    order_id: orderId,
    actor_id: profile?.id ?? null,
    actor_name: profile?.name ?? "Staff",
    type,
    detail: asJson(detail),
  });
}

function revalidateOrder(id: string) {
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/account/orders/${id}`);
  revalidatePath("/account/orders");
  revalidatePath("/account");
}

/** Apply a status transition: update, clear stale hold note, log, email. Returns an error string or null. */
async function applyStatus(
  service: ReturnType<typeof requireSupabaseServiceClient>,
  orderId: string,
  status: OrderStatus,
  prevStatus: string | null | undefined
): Promise<string | null> {
  const patch: OrderUpdate = { status };
  // Leaving a hold clears its note.
  if (status !== "on_hold" && prevStatus === "on_hold") patch.hold_note = null;
  const { error } = await service.from("orders").update(patch).eq("id", orderId);
  if (error) return error.message;
  // A step BACKWARDS (e.g. shipped -> production for a reprint) gets its own
  // activity entry on top of the normal status_change, so the reversal is easy
  // to spot in the log. status_reverted is admin-only (it is not in the
  // customer-visible activity allowlist).
  const backwards = isBackwardStatus(prevStatus, status);
  await logActivity(service, orderId, "status_change", { from: prevStatus, to: status, backwards });
  if (backwards) await logActivity(service, orderId, "status_reverted", { from: prevStatus, to: status });
  await sendOrderStatusEmail(orderId, status);
  return null;
}

export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  /** Required to cancel a PAID order (a refund may be owed), the UI confirms first. */
  confirmed = false
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();

  const { data: prev } = await service
    .from("orders")
    .select("status, paid_at, stripe_checkout_session_id")
    .eq("id", orderId)
    .single();

  // Minimal transition guards (one-man shop, permissive, only the dangerous moves).
  if (status === "proof_ready" && prev?.status !== "proof_ready") {
    // No proof waiting means nothing to review, don't email an approve-and-pay CTA.
    const { count } = await service
      .from("proofs")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .eq("status", "pending");
    if (!count) return { error: "Upload a proof before moving this order to Proof ready." };
  }
  if (status === "cancelled" && prev?.paid_at && !confirmed) {
    return { error: "This order is already paid. Confirm the cancellation, a refund may be owed." };
  }

  const err = await applyStatus(service, orderId, status, prev?.status);
  if (err) return { error: err };

  // Cancelling kills any open payment link so a stale Stripe tab can't complete.
  if (status === "cancelled") {
    await expireOpenCheckoutSession({ stripe_checkout_session_id: prev?.stripe_checkout_session_id ?? null });
  }

  revalidateOrder(orderId);
  return { ok: true };
}

/** Statuses from which saving a tracking number auto-advances a ship order to "shipped". */
const SHIP_ON_TRACKING = new Set<string>([
  "submitted", "in_review", "proof_ready", "changes_requested", "approved", "in_production", "quality_check",
]);

export async function setPaymentStatusAction(
  orderId: string,
  paymentStatus: PaymentStatus
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();

  const { data: order } = await service
    .from("orders")
    .select("paid_at, stripe_checkout_session_id")
    .eq("id", orderId)
    .single();

  const patch: OrderUpdate = { payment_status: paymentStatus };
  // A manual "paid in full" (e.g. cash) must also stamp paid_at, or the customer's
  // self-serve Pay button stays open and the order could be charged again via Stripe.
  // Only stamp when not already paid, never move an existing paid timestamp.
  const markingPaid = paymentStatus === "paid_in_full" && !order?.paid_at;
  if (markingPaid) patch.paid_at = new Date().toISOString();
  // Reopening to unpaid clears the timestamp so the pay flow can run again.
  if (paymentStatus === "unpaid") patch.paid_at = null;

  const { error } = await service.from("orders").update(patch).eq("id", orderId);
  if (error) return { error: error.message };

  // Killing any open Stripe session prevents a double charge on the now-paid order.
  if (markingPaid) {
    await expireOpenCheckoutSession({ stripe_checkout_session_id: order?.stripe_checkout_session_id ?? null });
  }

  await logActivity(service, orderId, "payment_status", { to: paymentStatus, paidAt: patch.paid_at ?? null });
  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * Admin checked the bank and the customer's Interac e-Transfer landed: mark the
 * order paid (full payment_received flow: activity, customer email, Stripe
 * session expiry so an old card link can't double-charge) and optionally move
 * an approved order straight into production.
 */
export async function confirmEtransferAction(
  orderId: string,
  startProduction: boolean
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const profile = await getProfile();

  const { data: order } = await service
    .from("orders")
    .select("status, paid_at, stripe_checkout_session_id")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found." };
  if (order.paid_at) return { error: "This order is already paid." };

  const res = await markOrderPaid(service, orderId, null, "manual", true, {
    method: "etransfer",
    actorName: profile?.name ?? "Staff",
  });
  if (res.error) return { error: res.error };

  // An open Stripe checkout link could still charge the now-paid order.
  await expireOpenCheckoutSession({ stripe_checkout_session_id: order.stripe_checkout_session_id ?? null });

  if (startProduction && order.status === "approved") {
    const err = await applyStatus(service, orderId, "in_production", order.status);
    if (err) return { error: err };
  }

  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * Admin looked and the reported e-transfer never arrived. Clears the pending
 * flag (the customer's order page goes back to the normal payment options) and
 * optionally sends the customer a note explaining what to check.
 */
export async function etransferNotReceivedAction(
  orderId: string,
  messageToCustomer?: string
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();

  const { data: order } = await service.from("orders").select("paid_at").eq("id", orderId).single();
  if (!order) return { error: "Order not found." };
  if (order.paid_at) return { error: "This order is already paid." };

  const { error } = await service
    .from("orders")
    .update({ etransfer_reported_at: null, payment_method: null })
    .eq("id", orderId);
  if (error) return { error: error.message };
  await logActivity(service, orderId, "etransfer_not_received", {});

  const message = messageToCustomer?.trim();
  if (message) {
    const noted = await addOrderNoteAction(orderId, message, "customer");
    if (noted.error) return { error: noted.error };
  }

  revalidateOrder(orderId);
  return { ok: true };
}

export async function addOrderNoteAction(
  orderId: string,
  text: string,
  visibility: "internal" | "customer"
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const profile = await getProfile();

  const { data: order } = await service
    .from("orders")
    .select("internal_notes, customer_notes")
    .eq("id", orderId)
    .single();
  const current = visibility === "internal" ? order?.internal_notes : order?.customer_notes;
  const existing = (current ?? []) as unknown as { at: string; actor: string; text: string }[];
  const note = { at: new Date().toISOString(), actor: profile?.name ?? "Staff", text };
  const merged = asJson([...existing, note]);

  const patch: OrderUpdate = visibility === "internal" ? { internal_notes: merged } : { customer_notes: merged };
  const { error } = await service.from("orders").update(patch).eq("id", orderId);
  if (error) return { error: error.message };
  await logActivity(service, orderId, "note", { visibility });
  // A customer-visible comment reaches the customer's inbox too, with a link
  // back to their order page. Internal notes stay internal.
  if (visibility === "customer") {
    await sendOrderCommentEmail(orderId, text);
  }
  revalidateOrder(orderId);
  return { ok: true };
}

export async function updateOrderPricingAction(
  orderId: string,
  pricing: {
    subtotal: number;
    setupFees: number;
    rush: number;
    addons: number;
    shipping: number;
    tax: number;
    total: number;
    discountType?: DiscountType;
    discountValue?: number;
    discountLabel?: string;
    discount?: number;
    /** Named discounts (negative) and fees (positive), any number of rows. */
    adjustments?: PriceAdjustment[];
  },
  /** Required to edit a PAID order's pricing, the UI confirms first. */
  confirmed = false
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.pricing");
  const service = requireSupabaseServiceClient();

  // Every money field must be a real, non-negative number, never trust the client.
  const parts = [pricing.subtotal, pricing.setupFees, pricing.rush, pricing.addons, pricing.shipping, pricing.tax];
  if (pricing.discountValue !== undefined) parts.push(pricing.discountValue);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) {
    return { error: "Pricing values must be zero or greater." };
  }
  // Adjustments are the one signed field: a fee is positive, a discount negative.
  if ((pricing.adjustments ?? []).some((a) => !Number.isFinite(Number(a?.amount)))) {
    return { error: "Every discount or fee needs a number." };
  }

  const { data: order } = await service.from("orders").select("paid_at").eq("id", orderId).single();
  if (order?.paid_at && !confirmed) {
    return { error: "This order is already paid. Confirm before changing its pricing." };
  }

  // Recompute the total from the parts server-side, a tampered client sum can't
  // undercharge (or, once paid via Stripe, mismatch what was collected).
  const goods = pricing.subtotal + pricing.setupFees + pricing.rush + pricing.addons;
  const discount = resolveDiscount(goods, {
    discountType: pricing.discountType,
    discountValue: pricing.discountValue,
  });
  const adjustments = cleanAdjustments(pricing.adjustments ?? []);
  const total = orderTotal({
    subtotal: pricing.subtotal,
    setupFees: pricing.setupFees,
    rush: pricing.rush,
    addons: pricing.addons,
    discount,
    adjustments: adjustmentsTotal(adjustments),
    shipping: pricing.shipping,
    tax: pricing.tax,
  });
  const next = {
    subtotal: pricing.subtotal,
    setupFees: pricing.setupFees,
    rush: pricing.rush,
    addons: pricing.addons,
    shipping: pricing.shipping,
    tax: pricing.tax,
    discountType: pricing.discountType,
    discountValue: pricing.discountValue,
    discountLabel: pricing.discountLabel,
    discount,
    adjustments,
    total,
  };

  const { error } = await service.from("orders").update({ pricing: asJson(next) }).eq("id", orderId);
  if (error) return { error: error.message };
  await logActivity(service, orderId, "price_edit", { total });
  revalidateOrder(orderId);
  return { ok: true };
}

export interface OrderDetailsInput {
  /** Written to the customer's profile when the order has one. */
  contactName?: string;
  contactPhone?: string;
  /** Guest orders only, the notification email. */
  guestEmail?: string;
  shipping: {
    name?: string;
    company?: string;
    phone?: string;
    street?: string;
    city?: string;
    prov?: string;
    postal?: string;
  };
  billing: { name?: string; email?: string; company?: string } | null;
  shippingMethod: string;
  fulfillmentMethod: string;
}

export async function updateOrderDetailsAction(
  orderId: string,
  input: OrderDetailsInput
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();

  const { data: order } = await service
    .from("orders")
    .select("customer_id, shipping_address")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found." };

  const existingShip = (order.shipping_address ?? {}) as Record<string, unknown>;
  const patch: OrderUpdate = {
    shipping_address: asJson({ ...existingShip, ...input.shipping }),
    billing_address: input.billing ? asJson(input.billing) : null,
    shipping_method: input.shippingMethod,
    fulfillment_method: input.fulfillmentMethod,
  };
  if (!order.customer_id && input.guestEmail !== undefined) {
    patch.guest_email = input.guestEmail.trim() || null;
  }
  const { error } = await service.from("orders").update(patch).eq("id", orderId);
  if (error) return { error: error.message };

  if (order.customer_id && (input.contactName !== undefined || input.contactPhone !== undefined)) {
    const profilePatch: { name?: string; phone?: string } = {};
    if (input.contactName?.trim()) profilePatch.name = input.contactName.trim();
    if (input.contactPhone !== undefined) profilePatch.phone = input.contactPhone.trim();
    if (Object.keys(profilePatch).length) {
      await service.from("profiles").update(profilePatch).eq("id", order.customer_id);
    }
  }

  await logActivity(service, orderId, "details_updated", {});
  revalidateOrder(orderId);
  return { ok: true };
}

/** One decoration placement ("spot") on a garment, stored in line_items.decorations. */
export interface DecorationSpot {
  location: string;
  type: string;
  widthIn: string;
  heightIn: string;
  colours: string;
  pantones: string[];
  puff: boolean;
  spotProcess: boolean;
}

export interface LineItemDecorations {
  spots: DecorationSpot[];
  bagging: boolean;
  sewnTags: boolean;
  priceConfirmed: boolean;
  /** Per-line production tracking (independent of the order status). */
  productionStatus?: LineProductionStatus;
  /** Manufacturing instructions for this line (e.g. white underbase on darks). */
  productionNotes?: string;
  /** Private team notes, never shown to the customer. */
  internalNotes?: string;
  /** Info for the shipping label (e.g. gate code, delivery instructions). */
  shippingNotes?: string;
  /**
   * Line ops, tracked per garment because one order's lines can come from
   * different suppliers and land on different days.
   * `fulfilled`: the blanks for this line are in hand.
   * `supplier`: who the blanks were bought from (see SUPPLIER_OPTIONS).
   */
  fulfilled?: boolean;
  supplier?: string;
  /** Manual queue order within the order (lower = higher up). */
  position?: number;
  /**
   * Stale-price nudge set by a product swap: the new product's curve price at
   * the line's quantity, when it differs from the stored unit price. Cleared
   * when admin applies or dismisses it (via the normal items save).
   */
  priceSuggestion?: { unit: number; qty: number } | null;
}

export interface LineItemPatch {
  id: string;
  productName: string;
  sizeQuantities: Record<string, number>;
  unitPrice: number;
  decorations: LineItemDecorations;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sumSizes = (sq: Record<string, number>) =>
  Object.values(sq).reduce((a, b) => a + (Number(b) > 0 ? Number(b) : 0), 0);

/** Recompute order pricing from its line items (subtotal excludes setup, which lives on the lines). */
async function syncOrderPricing(service: ReturnType<typeof requireSupabaseServiceClient>, orderId: string) {
  const [{ data: items }, { data: order }, { data: addonRow }] = await Promise.all([
    service.from("line_items").select("unit_price, size_quantities, decorations").eq("order_id", orderId),
    service.from("orders").select("pricing, shipping_address, fulfillment_method").eq("id", orderId).single(),
    service.from("settings").select("value").eq("key", "addons").maybeSingle(),
  ]);
  const pricing = (order?.pricing ?? {}) as {
    setupFees?: number;
    rush?: number;
    shipping?: number;
    tax?: number;
    discountType?: DiscountType;
    discountValue?: number;
    discountLabel?: string;
    adjustments?: unknown;
  };
  const addonSettings = mergeAddonSettings(addonRow?.value);
  const subtotal = round2(
    (items ?? []).reduce((sum, li) => sum + li.unit_price * sumSizes((li.size_quantities ?? {}) as Record<string, number>), 0)
  );
  // Per-unit add-on charges (bagging / sewn tags / spot process) driven by the line checkboxes.
  const addons = round2(
    (items ?? []).reduce((sum, li) => {
      const dec = (li.decorations ?? {}) as Partial<LineItemDecorations>;
      return sum + lineAddonTotal(dec, sumSizes((li.size_quantities ?? {}) as Record<string, number>), addonSettings);
    }, 0)
  );
  const setupFees = pricing.setupFees ?? 0;
  const rush = pricing.rush ?? 0;
  const shipping = pricing.shipping ?? 0;
  // Preserve the admin's manual discount across auto-recompute (re-resolve against the new goods).
  const discountType = pricing.discountType;
  const discountValue = pricing.discountValue;
  const discountLabel = pricing.discountLabel;
  const discount = resolveDiscount(subtotal + setupFees + rush + addons, { discountType, discountValue });
  // Manual discount/fee rows survive an auto-recompute untouched.
  const adjustments = normalizeAdjustments(pricing.adjustments);
  const adjTotal = adjustmentsTotal(adjustments);
  // Re-derive tax from the shipping province on the recomputed base (matches the
  // PricingCard live formula) so an item edit can't leave a stale tax the customer
  // then pays. Pickup or an unreadable province falls back to the shop's province.
  const prov = resolveTaxProvince({
    prov: (order?.shipping_address as { prov?: string } | null)?.prov,
    fulfillmentMethod: order?.fulfillment_method,
  }).code;
  const base = { subtotal, setupFees, rush, addons, discount, adjustments: adjTotal, shipping };
  const tax = calcTax(taxableBase(base), prov).total;
  const next = {
    subtotal,
    setupFees,
    rush,
    addons,
    shipping,
    tax,
    discountType,
    discountValue,
    discountLabel,
    discount,
    adjustments,
    total: orderTotal({ ...base, tax }),
  };
  await service.from("orders").update({ pricing: asJson(next) }).eq("id", orderId);
  return next;
}

export async function updateLineItemsAction(
  orderId: string,
  items: LineItemPatch[]
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const profile = await getProfile();
  const canPrice = hasPermission(profile, "orders.pricing");

  const { data: existing } = await service
    .from("line_items")
    .select("id, unit_price, setup_fee")
    .eq("order_id", orderId);
  const byId = new Map((existing ?? []).map((li) => [li.id, li]));

  for (const patch of items) {
    const row = byId.get(patch.id);
    if (!row) return { error: "Line item not found on this order." };
    // Unit price changes require the pricing permission; others keep the stored price.
    const rawUnit = canPrice ? patch.unitPrice : row.unit_price;
    // Clamp money to a real, non-negative number (a NaN/negative would poison the total).
    const unitPrice = Number.isFinite(rawUnit) && rawUnit >= 0 ? rawUnit : 0;
    const setupFee = Number.isFinite(row.setup_fee) && row.setup_fee >= 0 ? row.setup_fee : 0;
    const qty = sumSizes(patch.sizeQuantities);
    const { error } = await service
      .from("line_items")
      .update({
        product_name: patch.productName.trim() || null,
        size_quantities: asJson(patch.sizeQuantities),
        unit_price: unitPrice,
        // The stale-price nudge is UI-only, never persist it (customers can read
        // decorations jsonb via RLS, and it can't be column-guarded).
        decorations: asJson({ ...patch.decorations, priceSuggestion: null }),
        line_total: round2(unitPrice * qty + setupFee),
      })
      .eq("id", patch.id);
    if (error) return { error: error.message };
  }

  const pricing = await syncOrderPricing(service, orderId);
  await logActivity(service, orderId, "items_updated", { count: items.length, total: pricing.total });
  revalidateOrder(orderId);
  return { ok: true };
}

export async function deleteLineItemAction(
  orderId: string,
  lineItemId: string
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const { error } = await service.from("line_items").delete().eq("id", lineItemId).eq("order_id", orderId);
  if (error) return { error: error.message };
  await syncOrderPricing(service, orderId);
  await logActivity(service, orderId, "item_removed", {});
  revalidateOrder(orderId);
  return { ok: true };
}

/** A product colour slimmed down for the change-product picker. */
export interface SwapProductColour {
  name: string;
  hex: string | null;
  /** Blank garment shot for the colour tile (front, falling back to model/side). */
  thumb: string | null;
  inStock: boolean;
}

/** A catalog product slimmed down for the change-product picker. */
export interface SwapProduct {
  id: string;
  name: string;
  brand: string | null;
  ssStyleName: string | null;
  isActive: boolean;
  stockStatus: string;
  /** Card thumbnail, the primary colour's blank shot. */
  thumb: string | null;
  colours: SwapProductColour[];
}

const colourThumb = (c: ProductColourJson) => c.images?.front ?? c.images?.model ?? c.images?.side ?? null;

/**
 * The catalog, slimmed for the "Change product" picker on a line item.
 * Includes hidden (inactive) products, flagged so the UI can badge them,
 * since admin may swap to something not yet live in the shop.
 */
export async function listSwapProductsAction(): Promise<{ products?: SwapProduct[]; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const { data, error } = await service
    .from("products")
    .select("id, name, brand, ss_style_name, is_active, stock_status, colours")
    .order("is_active", { ascending: false })
    .order("name");
  if (error) return { error: error.message };

  const products: SwapProduct[] = (data ?? []).map((p) => {
    // Admin-disabled colours stay out of the picker, same as the shop.
    const colours = ((p.colours ?? []) as unknown as ProductColourJson[]).filter((c) => c.enabled !== false);
    const primary = colours.find((c) => c.primary) ?? colours[0];
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      ssStyleName: p.ss_style_name,
      isActive: p.is_active,
      stockStatus: p.stock_status,
      thumb: primary ? colourThumb(primary) : null,
      colours: colours.map((c) => ({
        name: c.name,
        hex: c.hex ?? null,
        thumb: colourThumb(c),
        inStock: c.inStock !== false,
      })),
    };
  });
  return { products };
}

/**
 * The new product's curve price at the line's config, for the stale-price
 * nudge. Decoration/colours/locations are derived from the line's print spots
 * (best effort: this is a suggestion, admin confirms it).
 */
function suggestUnitPrice(
  pricingRules: Json | null,
  decorations: Partial<LineItemDecorations>,
  qty: number
): number | null {
  const curve = (pricingRules as { quote?: ProductQuoteCurveJson } | null)?.quote;
  if (!curve || qty <= 0) return null;

  const spots = decorations.spots ?? [];
  const wantsEmbroidery = spots.some((s) => /embroider/i.test(s.type));
  const decoration: QuoteDecoration =
    wantsEmbroidery && curve.breaks.embroidery?.length
      ? "embroidery"
      : curve.breaks.screen?.length
        ? "screen"
        : defaultDecoration(curve);
  // Screen colour surcharge keys off the largest per-spot colour count (non-numeric
  // entries like "Full colour" fall back to 1; the curve caps surcharges anyway).
  const colours = Math.max(1, ...spots.map((s) => parseInt(s.colours, 10) || 1));
  const locations = Math.max(1, spots.length);

  const result = priceFromCurve(curve, { qty, colours, locations, decoration });
  return result.available ? round2(result.perUnit) : null;
}

/**
 * Swap the garment on a line item (customer changed their mind mid-order).
 * Requires an explicit colour pick: the new product's colours never map 1:1,
 * so nothing is auto-selected. Sizes, prints, notes, design and pricing are
 * all kept. The price is NOT auto-changed; instead, when the new product's
 * curve price differs from the stored unit price, a suggestion is RETURNED to
 * the client (for a display-only nudge), never persisted, since customers can
 * read the decorations jsonb via RLS.
 */
export async function changeLineItemProductAction(
  orderId: string,
  lineItemId: string,
  productId: string,
  colourName: string
): Promise<{ ok?: boolean; error?: string; suggestion?: { unit: number; qty: number } | null }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();

  const [{ data: line }, { data: product }] = await Promise.all([
    service
      .from("line_items")
      .select("id, product_name, unit_price, size_quantities, decorations")
      .eq("id", lineItemId)
      .eq("order_id", orderId)
      .maybeSingle(),
    service.from("products").select("id, name, colours, pricing_rules").eq("id", productId).maybeSingle(),
  ]);
  if (!line) return { error: "Line item not found on this order." };
  if (!product) return { error: "Product not found." };

  const colours = (product.colours ?? []) as unknown as ProductColourJson[];
  const norm = (s: string) => s.trim().toLowerCase();
  const colour = colours.find((c) => norm(c.name) === norm(colourName));
  if (!colour) return { error: "Pick a colour from the new product." };

  // Stale-price nudge: suggest the new product's curve price when it differs.
  const decorations = (line.decorations ?? {}) as Partial<LineItemDecorations>;
  const qty = sumSizes((line.size_quantities ?? {}) as Record<string, number>);
  const curveUnit = suggestUnitPrice(product.pricing_rules, decorations, qty);
  const suggestion =
    curveUnit !== null && Math.abs(curveUnit - line.unit_price) >= 0.01 ? { unit: curveUnit, qty } : null;

  const { error } = await service
    .from("line_items")
    .update({
      product_id: product.id,
      product_name: product.name,
      colour: asJson({ name: colour.name, hex: colour.hex ?? null }),
      // The suggestion is returned to the client for display only, never persisted
      // (customers can read decorations jsonb via RLS, see suggestUnitPrice header).
      decorations: asJson({ ...decorations, priceSuggestion: null }),
    })
    .eq("id", lineItemId);
  if (error) return { error: error.message };

  await logActivity(service, orderId, "product_changed", {
    from: line.product_name,
    to: product.name,
    colour: colour.name,
  });
  revalidateOrder(orderId);
  return { ok: true, suggestion };
}

/**
 * Upload an official mockup/proof (already staged in the proofs bucket). This
 * only FILES the proof on the order: no status change and no customer email.
 * The whole order goes out at once via the explicit "Send for approval" action
 * (setOrderStatusAction -> proof_ready), after everything is checked and
 * finalized. Uploading onto a cancelled order is refused.
 */
export async function uploadProofsAction(
  orderId: string,
  proofPaths: string[],
  lineItemId?: string
): Promise<{ ok?: boolean; error?: string; note?: string }> {
  await requirePermission("proofs.manage");
  const service = requireSupabaseServiceClient();
  const profile = await getProfile();

  const paths = proofPaths.filter(Boolean);
  if (paths.length === 0) return { error: "No proof files selected." };

  const { data: order } = await service
    .from("orders")
    .select("official_mockups, status")
    .eq("id", orderId)
    .single();
  if (order?.status === "cancelled") {
    return { error: "This order was cancelled, reopen it before adding a proof." };
  }

  // Sign every uploaded file (front / back / …); a single unsignable file
  // fails the whole batch so the customer never gets a partial proof set.
  const signed: { url: string; path: string }[] = [];
  for (const path of paths) {
    const { data } = await service.storage.from("proofs").createSignedUrl(path, YEAR);
    if (!data?.signedUrl) return { error: "Could not sign one of the uploaded proofs." };
    signed.push({ url: data.signedUrl, path });
  }

  const { error: pErr } = await service.from("proofs").insert(
    signed.map((s) => ({
      order_id: orderId,
      line_item_id: lineItemId ?? null,
      image: s.url,
      status: "pending" as const,
      created_by: profile?.id ?? null,
    }))
  );
  if (pErr) return { error: pErr.message };

  const mockups = (order?.official_mockups ?? []) as { url: string; path: string }[];
  await service
    .from("orders")
    .update({ official_mockups: asJson([...mockups, ...signed]) } satisfies OrderUpdate)
    .eq("id", orderId);

  await logActivity(service, orderId, "proof_uploaded", { count: signed.length });
  revalidateOrder(orderId);
  // On an order already open for approval the new file is visible to the
  // customer immediately; everywhere else it waits for "Send for approval".
  const note =
    order?.status === "proof_ready"
      ? "Proof added. This order is already with the customer, so they can see it right away."
      : "Proof saved to the order. Nothing is emailed until you send the order for approval.";
  return { ok: true, note };
}

/**
 * Email (or re-email) the payment link: mint/reuse a Stripe Checkout session
 * for the current order total, stamp invoice fields, and send the customer
 * their public order link with the Pay button. OPTIONAL in the approve-and-pay
 * flow (an approved order is payable self-serve), this is the nudge/reminder,
 * and the only way to open payment BEFORE proof approval. Requires the pricing
 * permission.
 */
export async function sendInvoiceAction(orderId: string): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.pricing");
  const service = requireSupabaseServiceClient();

  const { data: order } = await service
    .from("orders")
    .select("id, order_number, public_token, customer_id, guest_email, pricing, status, stripe_checkout_session_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "Order not found." };
  if (order.status === "draft" || order.status === "cancelled") {
    return { error: "Can't invoice a draft or cancelled order." };
  }

  const session = await ensureCheckoutSession(service, order);
  if (session.error) return { error: session.error };

  const pricing = (order.pricing ?? {}) as { total?: number };
  const { error } = await service
    .from("orders")
    .update({ invoice_sent_at: new Date().toISOString(), invoice_amount: pricing.total ?? null })
    .eq("id", orderId);
  if (error) return { error: error.message };

  await logActivity(service, orderId, "invoice_sent", { total: pricing.total ?? 0 });
  await sendOrderEmail(orderId, "invoice_sent");
  revalidateOrder(orderId);
  return { ok: true };
}

/** Set the shipment tracking number (shows on the customer's order page + shipped email). */
export async function setTrackingAction(
  orderId: string,
  tracking: string
): Promise<{ ok?: boolean; error?: string; shipped?: boolean }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const value = tracking.trim() || null;

  const { data: prev } = await service.from("orders").select("status, fulfillment_method").eq("id", orderId).single();
  const { error } = await service.from("orders").update({ shipping_tracking: value }).eq("id", orderId);
  if (error) return { error: error.message };
  await logActivity(service, orderId, "tracking_updated", { tracking: value });

  // Saving a real tracking number on a ship order that hasn't shipped yet marks it shipped.
  let shipped = false;
  if (value && prev?.fulfillment_method === "ship" && SHIP_ON_TRACKING.has(prev.status)) {
    const err = await applyStatus(service, orderId, "shipped", prev.status);
    if (err) return { error: err };
    shipped = true;
  }

  revalidateOrder(orderId);
  return { ok: true, shipped };
}

/** The three static note fields at the bottom of the order page (customer / inventory / printer). */
export async function updateProductionNotesAction(
  orderId: string,
  notes: ProductionNotesJson
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("orders.edit");
  const service = requireSupabaseServiceClient();
  const clean: ProductionNotesJson = {
    customer: notes.customer?.trim() || undefined,
    inventory: notes.inventory?.trim() || undefined,
    printer: notes.printer?.trim() || undefined,
  };
  const { error } = await service.from("orders").update({ production_notes: asJson(clean) }).eq("id", orderId);
  if (error) return { error: error.message };
  revalidateOrder(orderId);
  return { ok: true };
}
