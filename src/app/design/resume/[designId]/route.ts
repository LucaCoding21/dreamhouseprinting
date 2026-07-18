import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { claimGuestRecords } from "@/lib/claim";
import { GUEST_COOKIE, GUEST_COOKIE_OPTIONS, getGuestToken } from "@/lib/guest";

/**
 * Guest design-resume link (from the "your design is saved" email). The `?t=`
 * query token must equal the design's stored guest_token exactly — the design id
 * alone is not enough. Any mismatch/missing/lookup failure silently redirects to
 * /shop so we never confirm whether a given design id exists.
 *
 * Because the emailed link is forwardable, the `?t=` token alone would let a
 * stranger claim someone else's design, so we branch on the visitor:
 *   - authenticated: never touch the guest cookie; proceed only if the design's
 *     lead email matches the account (proof of ownership), attaching it to the
 *     account so the logged-in designer loader finds it.
 *   - guest with a DIFFERENT cookie already: don't clobber it (that would orphan
 *     their own in-progress work); re-key the resumed design to their token so
 *     both stay reachable.
 *   - guest with no cookie (or the same token): restore the design's guest cookie.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ designId: string }> },
) {
  const { designId } = await ctx.params;
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("t");

  const toShop = NextResponse.redirect(new URL("/shop", origin));
  if (!token) return toShop;

  const service = createSupabaseServiceClient();
  if (!service) return toShop;

  const { data } = await service
    .from("designs")
    .select("id, product_id, guest_token, lead_email")
    .eq("id", designId)
    .maybeSingle();

  if (!data || !data.guest_token || data.guest_token !== token) return toShop;

  const dest = new URL(`/design/${data.product_id}?design=${data.id}`, origin);

  // Authenticated visitor: identified by their session, not the guest cookie.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const accountEmail = user.email?.trim().toLowerCase() ?? "";
    const leadEmail = (data.lead_email ?? "").trim().toLowerCase();
    // Only the person the design was saved for may resume it into their account.
    if (!accountEmail || leadEmail !== accountEmail) return toShop;
    // Email match is proof of ownership — attach the guest design so the
    // logged-in (customer_id-scoped) designer loader can read it. No cookie set.
    await claimGuestRecords(user.id, user.email!);
    return NextResponse.redirect(dest);
  }

  // Guest with an existing, different cookie: keep their identity, and re-home
  // the resumed design under it so both their old and resumed work stay reachable.
  const existing = await getGuestToken();
  if (existing && existing !== token) {
    await service.from("designs").update({ guest_token: existing }).eq("id", data.id);
    return NextResponse.redirect(dest);
  }

  // Guest with no cookie (or already the same token): restore the design's guest
  // cookie so page.tsx's guest-scoped loader authorizes it on this browser.
  const res = NextResponse.redirect(dest);
  res.cookies.set(GUEST_COOKIE, token, GUEST_COOKIE_OPTIONS);
  return res;
}
