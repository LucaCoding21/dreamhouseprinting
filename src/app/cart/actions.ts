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
  turnaround: "standard" | "rush";
  /** Customer's requested in-hand date (YYYY-MM-DD), only on a rush. */
  neededBy?: string | null;
}

export interface PlaceCartResult {
  placed: { designId: string; orderNumber?: string }[];
  failed: { designId: string; error: string }[];
}

/**
 * Lite-cart checkout: place one Order per carted design, reusing the existing
 * per-design checkout actions. Contact/address is collected once on /cart and
 * written for every design before its order is placed. Each design that fails
 * is reported back so the cart can keep the unsubmitted ones.
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
      turnaround: input.turnaround,
      neededBy: input.neededBy,
    });
    if (order.error) {
      failed.push({ designId, error: order.error });
      continue;
    }
    placed.push({ designId, orderNumber: order.orderNumber });
  }

  return { placed, failed };
}
