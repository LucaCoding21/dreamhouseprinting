"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { mergeCheckoutSettings, type CheckoutSettings } from "@/lib/checkoutSettings";
import { mergeAddonSettings, type AddonSettings } from "@/lib/addonSettings";
import { mergePaymentSettings, type PaymentSettings } from "@/lib/paymentSettings";
import { mergeBusinessSettings, type BusinessSettings } from "@/lib/businessSettings";
import type { Json, Database } from "@/lib/db/types";

type DecorationMethodUpdate = Database["public"]["Tables"]["decoration_methods"]["Update"];
const asJson = (v: unknown) => v as unknown as Json;

/** Fields a settings.manage user may edit on a decoration method. */
export interface DecorationMethodPatch {
  name?: string;
  description?: string | null;
  setup_fee?: number;
  per_unit_cost?: number;
  per_color_cost?: number;
  is_active?: boolean;
}

export async function updateDecorationMethodAction(
  id: string,
  fields: DecorationMethodPatch
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("settings.manage");
  const service = requireSupabaseServiceClient();

  // Build the typed Update patch explicitly so strict typing holds.
  const patch: DecorationMethodUpdate = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.setup_fee !== undefined) patch.setup_fee = fields.setup_fee;
  if (fields.per_unit_cost !== undefined) patch.per_unit_cost = fields.per_unit_cost;
  if (fields.per_color_cost !== undefined) patch.per_color_cost = fields.per_color_cost;
  if (fields.is_active !== undefined) patch.is_active = fields.is_active;

  const { error } = await service.from("decoration_methods").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/services");
  revalidatePath("/design");
  return { ok: true };
}

/** The whole email_templates object: { [key]: { subject, body } }. */
export type EmailTemplateMap = Record<string, { subject: string; body: string }>;

export async function updateEmailTemplatesAction(
  templates: EmailTemplateMap
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("settings.manage");
  const service = requireSupabaseServiceClient();

  const { error } = await service
    .from("settings")
    .upsert({ key: "email_templates", value: asJson(templates) }, { onConflict: "key" });
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function updateCheckoutSettingsAction(
  settings: CheckoutSettings
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("settings.manage");
  const service = requireSupabaseServiceClient();

  // Normalize through the merge so partial/odd payloads can't corrupt the row.
  const clean = mergeCheckoutSettings(settings);
  const { error } = await service
    .from("settings")
    .upsert({ key: "checkout", value: asJson(clean) }, { onConflict: "key" });
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function updatePaymentSettingsAction(
  settings: PaymentSettings
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("settings.manage");
  const service = requireSupabaseServiceClient();

  const clean = mergePaymentSettings(settings);
  if (clean.etransferEnabled && clean.etransferEmail.trim() && !/^\S+@\S+\.\S+$/.test(clean.etransferEmail.trim())) {
    return { error: "That e-transfer email doesn't look like a valid address." };
  }
  const { error } = await service
    .from("settings")
    .upsert({ key: "payments", value: asJson(clean) }, { onConflict: "key" });
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  // The customer order pages read this at render time; no other paths cached.
  return { ok: true };
}

export async function updateBusinessSettingsAction(
  settings: BusinessSettings
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("settings.manage");
  const service = requireSupabaseServiceClient();

  const clean = mergeBusinessSettings(settings);
  const { error } = await service
    .from("settings")
    .upsert({ key: "business", value: asJson(clean) }, { onConflict: "key" });
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  // The cart's pickup panel reads this at render time.
  revalidatePath("/cart");
  return { ok: true };
}

export async function updateAddonSettingsAction(
  settings: AddonSettings
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("settings.manage");
  const service = requireSupabaseServiceClient();

  const clean = mergeAddonSettings(settings);
  const { error } = await service
    .from("settings")
    .upsert({ key: "addons", value: asJson(clean) }, { onConflict: "key" });
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { ok: true };
}
