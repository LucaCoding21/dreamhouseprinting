import { cookies } from "next/headers";

/**
 * Guest identity for logged-out checkout. A random token is stored in an
 * httpOnly cookie and on the guest's design rows; checkout pages/actions
 * authorize a guest by matching the cookie to the design's guest_token. This
 * keeps a design's checkout reachable only from the browser that created it
 * (the design id alone is not enough).
 */
/** Guest cookie name + write options — shared so every setter matches exactly
 *  (getOrCreateGuestToken here, plus the design-resume route that restores it on
 *  a fresh device from an emailed link). */
export const GUEST_COOKIE = "dh_guest";
export const GUEST_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

/** Read the guest token (read-only — safe in Server Components / loaders). */
export async function getGuestToken(): Promise<string | null> {
  const c = await cookies();
  return c.get(GUEST_COOKIE)?.value ?? null;
}

/**
 * Read the guest token, creating + setting it if absent. Only call from a Server
 * Action or Route Handler (cookie writes are not allowed in Server Components).
 */
export async function getOrCreateGuestToken(): Promise<string> {
  const c = await cookies();
  const existing = c.get(GUEST_COOKIE)?.value;
  if (existing) return existing;
  const token = crypto.randomUUID();
  c.set(GUEST_COOKIE, token, GUEST_COOKIE_OPTIONS);
  return token;
}
