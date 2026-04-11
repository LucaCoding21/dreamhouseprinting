import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service role key.
 * NEVER import this into a client component.
 *
 * Returns null when env vars are missing so local dev can still run —
 * the API route will log submissions to the console instead.
 */
let _client: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_client !== undefined) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    _client = null;
    return null;
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export const SUBMISSIONS_TABLE = "submissions";
export const STORAGE_BUCKET = "quote-files";
