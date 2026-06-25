import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { mergeCheckoutSettings } from "@/lib/checkoutSettings";
import type { DecorationMethodRow, ProfileRow, SettingRow } from "@/lib/db/rows";
import { SettingsClient } from "./SettingsClient";

export const metadata = { title: "Settings — Admin" };

/** Shape of an email template entry stored in the email_templates settings jsonb. */
interface EmailTemplate {
  subject: string;
  body: string;
}

export default async function AdminSettingsPage() {
  await requirePermission("settings.manage");
  const service = requireSupabaseServiceClient();

  const [{ data: methods }, { data: staff }, { data: settings }] = await Promise.all([
    service.from("decoration_methods").select("*").order("display_order"),
    service.from("profiles").select("*").in("role", ["staff", "staff_admin"]),
    service.from("settings").select("*").in("key", ["shipping", "tax", "email_templates", "shop", "checkout"]),
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

  return (
    <SettingsClient
      decorationMethods={decorationMethods}
      staff={staffRows}
      emailTemplates={emailTemplates}
      checkout={checkout}
    />
  );
}
