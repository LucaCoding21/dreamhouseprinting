import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** All staff permission flags (PRD §1). staff_admin implicitly holds every one. */
export const STAFF_PERMISSIONS = [
  "orders.view",
  "orders.edit",
  "orders.pricing",
  "proofs.manage",
  "production.manage",
  "products.manage",
  "quotes.manage",
  "customers.view",
  "customers.edit",
  "reports.view",
  "settings.manage",
  "staff.manage",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

/** The authenticated auth.users record, or null. Cheap; cached per request by Supabase. */
export async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The current user's profile row (role, permissions, org), or null if logged out. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data ?? null;
}

export function isStaff(profile: Profile | null): boolean {
  return profile?.role === "staff" || profile?.role === "staff_admin";
}

export function hasPermission(profile: Profile | null, flag: StaffPermission): boolean {
  if (!profile) return false;
  if (profile.role === "staff_admin") return true;
  return profile.role === "staff" && (profile.staff_permissions ?? []).includes(flag);
}

/** Redirect to login (preserving return path) unless authenticated. Returns the user. */
export async function requireUser(nextPath = "/account") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** Gate a route to staff. Redirects non-staff away. Returns the staff profile. */
export async function requireStaff() {
  const profile = await getProfile();
  if (!isStaff(profile)) redirect("/login?next=/admin");
  return profile!;
}

/** Gate a route to a specific staff permission. Redirects if lacking. */
export async function requirePermission(flag: StaffPermission) {
  const profile = await requireStaff();
  if (!hasPermission(profile, flag)) redirect(`/admin?denied=${flag}`);
  return profile;
}
