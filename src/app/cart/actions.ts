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
 * Rush and the customer's note are NOT collected here: both are per-design asks
 * made in the designer and stored in the design's price snapshot, which
 * placeOrderAction reads. That keeps a two-design cart from forcing one rush
 * choice onto both jobs.
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
