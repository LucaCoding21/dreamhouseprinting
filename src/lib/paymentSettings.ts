/**
 * Payment options Julian controls from Admin -> Settings -> Payments. Stored in
 * the `settings` table under key "payments". Card checkout (Stripe) is always
 * on; Interac e-Transfer only surfaces to customers once it is enabled AND a
 * recipient email is set. Shared by the customer payment dialog, both order
 * pages, and the admin editor so the copy never drifts.
 */
export interface PaymentSettings {
  /** Offer Interac e-Transfer as a payment option. */
  etransferEnabled: boolean;
  /** The email customers send the transfer to. Empty = feature hidden. */
  etransferEmail: string;
  /** Extra line shown with the transfer instructions (autodeposit, security question, ...). */
  etransferNote: string;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  etransferEnabled: true,
  etransferEmail: "",
  etransferNote: "Autodeposit is on, so no security question is needed.",
};

/** Merge a stored settings blob over the defaults (defaults win for missing keys). */
export function mergePaymentSettings(raw: unknown): PaymentSettings {
  const v = (raw ?? {}) as Partial<PaymentSettings>;
  return {
    etransferEnabled: v.etransferEnabled ?? DEFAULT_PAYMENT_SETTINGS.etransferEnabled,
    etransferEmail: v.etransferEmail ?? DEFAULT_PAYMENT_SETTINGS.etransferEmail,
    etransferNote: v.etransferNote ?? DEFAULT_PAYMENT_SETTINGS.etransferNote,
  };
}

/** Customer-facing e-transfer details, or null when the option shouldn't be offered. */
export function etransferOption(settings: PaymentSettings): { email: string; note: string | null } | null {
  if (!settings.etransferEnabled) return null;
  const email = settings.etransferEmail.trim();
  if (!email) return null;
  return { email, note: settings.etransferNote.trim() || null };
}
