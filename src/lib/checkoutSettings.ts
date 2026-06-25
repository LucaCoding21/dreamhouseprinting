/**
 * Customer-facing checkout copy + toggles that Julian can tweak from
 * Admin → Settings → Checkout. Stored in the `settings` table under key
 * "checkout". Both the checkout flow and the admin editor read these defaults,
 * so the two never drift. Tax rates live in `@/lib/pricing/tax` (statutory, not
 * tweakable here).
 */
export interface CheckoutSettings {
  /** Note under the Delivery heading. */
  shippingNote: string;
  /** Offer in-shop pickup as a delivery option. */
  pickupEnabled: boolean;
  pickupNote: string;
  /** Offer the "ASAP / rush" turnaround choice. */
  rushEnabled: boolean;
  standardNote: string;
  rushNote: string;
  /** Paragraph under the "How soon do you need it?" heading. */
  timelineNote: string;
  /** Reassurance line under the checkout CTAs. */
  footnote: string;
}

export const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  shippingNote: "Free standard shipping on every order.",
  pickupEnabled: true,
  pickupNote: "From our shop, no charge",
  rushEnabled: true,
  standardNote: "Typical turnaround",
  rushNote: "Fastest we can — we'll confirm timing + fee",
  timelineNote:
    "Printing time isn't included above. Tell us if it's a rush — we'll confirm the exact timeline and any rush fee on your proof.",
  footnote: "No payment now — we review your artwork and send a proof to approve before anything is charged.",
};

/** Merge a stored settings blob over the defaults (defaults win for missing keys). */
export function mergeCheckoutSettings(raw: unknown): CheckoutSettings {
  const v = (raw ?? {}) as Partial<CheckoutSettings>;
  return {
    shippingNote: v.shippingNote ?? DEFAULT_CHECKOUT_SETTINGS.shippingNote,
    pickupEnabled: v.pickupEnabled ?? DEFAULT_CHECKOUT_SETTINGS.pickupEnabled,
    pickupNote: v.pickupNote ?? DEFAULT_CHECKOUT_SETTINGS.pickupNote,
    rushEnabled: v.rushEnabled ?? DEFAULT_CHECKOUT_SETTINGS.rushEnabled,
    standardNote: v.standardNote ?? DEFAULT_CHECKOUT_SETTINGS.standardNote,
    rushNote: v.rushNote ?? DEFAULT_CHECKOUT_SETTINGS.rushNote,
    timelineNote: v.timelineNote ?? DEFAULT_CHECKOUT_SETTINGS.timelineNote,
    footnote: v.footnote ?? DEFAULT_CHECKOUT_SETTINGS.footnote,
  };
}
