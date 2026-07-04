import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { GUEST_COOKIE, GUEST_COOKIE_OPTIONS } from "@/lib/guest";

/**
 * Guest design-resume link (from the "your design is saved" email). Restores the
 * guest cookie on ANY device, so an emailed link opens the design even from a
 * browser that never held the cookie. Authorization: the `?t=` query token must
 * equal the design's stored guest_token exactly — the design id alone is not
 * enough. Any mismatch/missing/lookup failure silently redirects to /shop so we
 * never confirm whether a given design id exists.
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
    .select("id, product_id, guest_token")
    .eq("id", designId)
    .maybeSingle();

  if (!data || !data.guest_token || data.guest_token !== token) return toShop;

  const res = NextResponse.redirect(
    new URL(`/design/${data.product_id}?design=${data.id}`, origin),
  );
  // Restore the exact guest cookie so page.tsx's guest-scoped loader authorizes
  // the design on this browser.
  res.cookies.set(GUEST_COOKIE, token, GUEST_COOKIE_OPTIONS);
  return res;
}
