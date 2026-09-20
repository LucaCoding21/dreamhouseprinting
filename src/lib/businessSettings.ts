/**
 * Shop / business details Julian controls from Admin -> Settings -> Checkout.
 * Stored in the `settings` table under key "business". Right now this is just
 * the pickup address the customer sees when they choose "Pick up" at checkout;
 * it also drives the embedded Google map. Kept separate from checkoutSettings so
 * the copy toggles and the physical address stay independently editable.
 */
export interface BusinessSettings {
  /** Where customers pick their order up. Empty = show a graceful placeholder. */
  pickupAddress: string;
}

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  pickupAddress: "",
};

/** Merge a stored settings blob over the defaults (defaults win for missing keys). */
export function mergeBusinessSettings(raw: unknown): BusinessSettings {
  const v = (raw ?? {}) as Partial<BusinessSettings>;
  return {
    pickupAddress: v.pickupAddress ?? DEFAULT_BUSINESS_SETTINGS.pickupAddress,
  };
}

/** The trimmed pickup address, or null when none is set yet. */
export function pickupAddress(settings: BusinessSettings): string | null {
  const addr = settings.pickupAddress.trim();
  return addr || null;
}

/** Google Maps embed URL for an address (no API key needed). */
export function mapEmbedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}
