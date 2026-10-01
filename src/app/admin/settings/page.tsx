import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { mergeCheckoutSettings } from "@/lib/checkoutSettings";
import { mergePaymentSettings } from "@/lib/paymentSettings";
import { mergeBusinessSettings } from "@/lib/businessSettings";
import type { DecorationMethodRow, ProfileRow, SettingRow } from "@/lib/db/rows";
import { SettingsClient } from "./SettingsClient";

export const metadata = { title: "Settings | Admin" };

/** Shape of an email template entry stored in the email_templates settings jsonb. */
interface EmailTemplate {
  subject: string;
  body: string;
}

export default async function AdminSettingsPage() {
  const service = requireSupabaseServiceClient();

  const [, { data: methods }, { data: staff }, { data: settings }] = await Promise.all([
    requirePermission("settings.manage"),
    service.from("decoration_methods").select("*").order("display_order"),
    service.from("profiles").select("*").in("role", ["staff", "staff_admin"]),
    service
      .from("settings")
      .select("*")
      .in("key", [
        "shipping",
        "tax",
        "email_templates",
        "shop",
        "checkout",
        "payments",
        "business",
      ]),
  ]);

  const decorationMethods = (methods ?? []) as DecorationMethodRow[];

  const staffRows = ((staff ?? []) as ProfileRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    permissionCount: p.role === "staff_admin" ? "All" : String((p.staff_permissions ?? []).length),
  }));

  const settingRows = (settings ?? []) as SettingRow[];
  const emailRow = settingRows.find((s) => s.key === "email_templates");
  const emailTemplates = (emailRow?.value ?? {}) as unknown as Record<string, EmailTemplate>;

  const checkoutRow = settingRows.find((s) => s.key === "checkout");
  const checkout = mergeCheckoutSettings(checkoutRow?.value);

  const paymentsRow = settingRows.find((s) => s.key === "payments");
  const payments = mergePaymentSettings(paymentsRow?.value);

  const businessRow = settingRows.find((s) => s.key === "business");
  const business = mergeBusinessSettings(businessRow?.value);

  // Real values for the email preview where we have them (same sources the
  // send uses), so the sample reads like what the customer will get.
  const shippingRow = settingRows.find((s) => s.key === "shipping");
  const emailPreview = {
    pickupLocation: ((shippingRow?.value ?? {}) as { pickupLocation?: string }).pickupLocation ?? "the shop",
    etransferEmail: payments.etransferEmail || "",
    businessAddress: process.env.BUSINESS_ADDRESS ?? null,
  };

  return (
    <SettingsClient
      decorationMethods={decorationMethods}
      staff={staffRows}
      emailTemplates={emailTemplates}
      emailPreview={emailPreview}
      checkout={checkout}
      payments={payments}
      business={business}
    />
  );
}
