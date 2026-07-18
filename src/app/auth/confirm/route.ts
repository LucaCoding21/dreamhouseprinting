import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { claimGuestRecords } from "@/lib/claim";

/** Attach any guest orders/designs to the freshly-verified account. */
async function claimForSession(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) await claimGuestRecords(user.id, user.email);
}

/**
 * Auth email-link landing route. Supabase can deliver either shape depending on
 * the email template / client flow:
 *   - token_hash + type   (default recovery/confirmation template) -> verifyOtp
 *   - code                (PKCE)                                   -> exchangeCodeForSession
 * Either way we establish the session cookies, then forward to `next`
 * (e.g. /reset-password for the forgot-password flow).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/account";
  // Only allow same-site relative paths. Reject protocol-relative ("//host") and
  // any backslash, which browsers normalise to "/" ("/\evil.com" -> "//evil.com").
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\")
      ? rawNext
      : "/account";

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      await claimForSession(supabase);
      return NextResponse.redirect(new URL(next, origin));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await claimForSession(supabase);
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
