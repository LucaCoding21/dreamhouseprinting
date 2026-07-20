import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getGuestToken } from "@/lib/guest";

/**
 * Escape a literal string for use as an `ilike` pattern. `ilike` with no `%`/`_`
 * wildcards is a case-insensitive equality match, but a stray wildcard in an
 * address (unusual, but possible) would widen the match, so neutralise them.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Attach guest orders/designs to the account that just authenticated. Guests
 * write `orders.guest_email` / `designs.lead_email` (customer_id null); nothing
 * links them to a profile, so after the same person registers/logs in their
 * portal (RLS-scoped to customer_id = auth.uid()) would otherwise show nothing.
 *
 * SECURITY: `email` MUST come from the authenticated Supabase user object
 * (getUser().email), proof of ownership. Never pass a form-supplied email, or a
 * caller could claim strangers' records. `userId` is likewise the auth user id.
 *
 * Idempotent (each call only touches still-unclaimed rows) and silent on failure
 * (logs, never throws) so it can be dropped into any auth path or run lazily in
 * the account area to self-heal a missed claim.
 */
export async function claimGuestRecords(userId: string, email: string): Promise<void> {
  const service = createSupabaseServiceClient();
  if (!service) return;

  const normalizedEmail = email.trim();

  try {
    if (normalizedEmail) {
      const pattern = escapeLike(normalizedEmail);

      const { error: ordersErr } = await service
        .from("orders")
        .update({ customer_id: userId })
        .is("customer_id", null)
        .ilike("guest_email", pattern);
      if (ordersErr) console.error("[claim] orders by email failed", ordersErr);

      const { error: designsErr } = await service
        .from("designs")
        .update({ customer_id: userId })
        .is("customer_id", null)
        .ilike("lead_email", pattern);
      if (designsErr) console.error("[claim] designs by email failed", designsErr);
    }

    // Also claim designs from THIS browser (same guest cookie), even if the
    // person saved them under a different email than the account they made.
    const guestToken = await getGuestToken();
    if (guestToken) {
      const { error: tokenErr } = await service
        .from("designs")
        .update({ customer_id: userId })
        .is("customer_id", null)
        .eq("guest_token", guestToken);
      if (tokenErr) console.error("[claim] designs by guest token failed", tokenErr);
    }
  } catch (e) {
    console.error("[claim] guest record claim failed", e);
  }
}
