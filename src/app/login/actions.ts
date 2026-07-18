"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { claimGuestRecords } from "@/lib/claim";

export interface AuthState {
  error?: string;
}

/** Success flag for the flows that stay on the page (no redirect) after acting. */
export interface AuthResult extends AuthState {
  done?: boolean;
}

/** Best-effort origin for building absolute auth redirect links (email links). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  // Only allow same-site relative paths. Reject protocol-relative ("//host") and
  // any backslash, which browsers normalise to "/" ("/\evil.com" -> "//evil.com").
  return n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "/account";
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // Attach any guest orders/designs left under this now-verified email.
  if (data.user?.email) await claimGuestRecords(data.user.id, data.user.email);

  redirect(next);
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!name) return { error: "Tell us your name." };
  if (!email || !password) return { error: "Enter an email and password." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, phone } },
  });
  if (error) return { error: error.message };

  // Attach any guest orders/designs left under this email — but only once the
  // email is confirmed (auto-confirm sets it immediately; with confirmation
  // required, /auth/confirm runs the claim instead). Claiming an unconfirmed
  // email would let anyone hijack a stranger's guest records by signing up
  // with their address.
  if (data.user?.email && data.user.email_confirmed_at) {
    await claimGuestRecords(data.user.id, data.user.email);
  }

  redirect(next);
}

/**
 * Sends a password-reset email. The link lands on /auth/confirm (which
 * establishes a short-lived recovery session) and forwards to /reset-password.
 * Always reports success even when the email is unknown, so the form never
 * reveals which addresses have accounts.
 *
 * NOTE: delivery depends on Supabase Auth SMTP being wired (see CLAUDE.md
 * pre-launch list) and this origin's /auth/confirm being in the project's
 * allowed redirect URLs. Neither is verifiable in local dev.
 */
export async function requestPasswordResetAction(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };

  const origin = await requestOrigin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin ? `${origin}/auth/confirm?next=/reset-password` : undefined,
  });
  // Surface only genuine failures (rate limits, config); never "no such user".
  if (error && error.status && error.status >= 500) return { error: error.message };

  return { done: true };
}

/**
 * Sets a new password for the user in the current (recovery) session. The
 * caller must already hold a session from the /auth/confirm recovery link;
 * /reset-password guards for that before rendering the form.
 */
export async function updatePasswordAction(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/account");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
