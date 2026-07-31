import "server-only";

import { cache } from "react";
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

/**
 * The authenticated auth.users record, or null. React cache() dedupes the
 * Supabase Auth round trip so layout + page + guards share one call per request.
 */
export const getUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The current user's profile row (role, permissions, org), or null if logged out. Deduped per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data ?? null;
});

/** Just the role, so callers that selected only that column can pass it. */
export type RoleOnly = Pick<Profile, "role">;

export function isStaff(profile: RoleOnly | null): boolean {
  return profile?.role === "staff" || profile?.role === "staff_admin";
}

/**
 * Where "my account" lives for a given user. Staff do not get a customer
 * portal: the shop IS their job, so the admin is their account. Anything that
 * would drop a signed-in person into /account routes through here instead of
 * hardcoding the path, and the /account layout enforces it as a backstop for
 * bookmarks and email links.
 */
export function accountHomePath(profile: RoleOnly | null): string {
  return isStaff(profile) ? "/admin" : "/account";
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
