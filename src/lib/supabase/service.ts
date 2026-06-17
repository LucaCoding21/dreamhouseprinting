import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * Service-role Supabase client — BYPASSES RLS. Server-only. Use exclusively for
 * privileged admin operations behind an explicit permission check (see
 * lib/auth.ts), and for system writes (S&S sync, order creation with generated
 * numbers, storage signing). NEVER import into a client component, and never
 * expose its results to a user who hasn't been authorized for them.
 *
 * Returns null when credentials are absent (graceful local dev / build).
 */
export function createSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Like createSupabaseServiceClient but throws if unconfigured — for paths that cannot degrade. */
export function requireSupabaseServiceClient() {
  const client = createSupabaseServiceClient();
  if (!client) {
    throw new Error("Supabase service client unavailable — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  }
  return client;
}
