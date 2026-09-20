"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/db/types";

const asJson = (v: unknown) => v as unknown as Json;

export async function updateProfileAction(input: {
  name: string;
  phone: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };
  // RLS allows a user to update their own profile row.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ name: input.name, phone: input.phone })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/account/settings");
  revalidatePath("/account");
  return { ok: true };
}

export async function updateNotificationPrefsAction(prefs: {
  email: boolean;
}): Promise<{ ok?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ notification_preferences: asJson(prefs) })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/account/settings");
  return { ok: true };
}
