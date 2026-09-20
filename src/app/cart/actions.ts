"use server";

import {
  saveContactAction,
  placeOrderAction,
  type CheckoutContactInput,
} from "@/app/checkout/[designId]/actions";

export interface PlaceCartInput {
  designIds: string[];
  contact: Omit<CheckoutContactInput, "designId">;
  fulfillment: "ship" | "pickup";
  /** Priced rush tier chosen at checkout, or null for no rush. */
  rushTier?: { days: number; pct: number } | null;
  /** Requested in-hand date from the "Pick a date" option. */
  neededBy?: string | null;
}

export interface PlaceCartResult {
  placed: { designId: string; orderId?: string; orderNumber?: string; publicToken?: string }[];
  failed: { designId: string; error: string }[];
}

/**
 * Lite-cart checkout: place one Order per carted design, reusing the existing
 * per-design checkout actions. Contact/address is collected once on /cart and
 * written for every design before its order is placed. Each design that fails
 * is reported back so the cart can keep the unsubmitted ones.
 *
 * Rush IS collected here: it is a property of the checkout, not of one design,
 * so the single choice made on /cart is applied to every order this places. The
 * percentage is re-resolved per order against that order's own server-side
 * subtotal, so each job pays the same rate on its own size.
 *
 * The customer's note stays per-design: it describes that artwork, so it rides
 * along in the design's price snapshot, which placeOrderAction reads.
 */
export async function placeCartOrdersAction(input: PlaceCartInput): Promise<PlaceCartResult> {
  const placed: PlaceCartResult["placed"] = [];
  const failed: PlaceCartResult["failed"] = [];

  for (const designId of input.designIds) {
    const saved = await saveContactAction({ ...input.contact, designId });
    if (saved.error) {
      failed.push({ designId, error: saved.error });
      continue;
    }
    const order = await placeOrderAction({
      designId,
      fulfillment: input.fulfillment,
      // Always send the key, even as null: that is what tells placeOrderAction
      // checkout owns the rush ask and a stale snapshot must not override it.
      rushTier: input.rushTier ?? null,
      neededBy: input.neededBy ?? null,
    });
    if (order.error) {
      failed.push({ designId, error: order.error });
      continue;
    }
    placed.push({
      designId,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      publicToken: order.publicToken,
    });
  }

  return { placed, failed };
}
