import "server-only";

import { headers } from "next/headers";

/** Path of the public (no-login) order page for a given order token. */
export function publicOrderPath(token: string): string {
  return `/o/${token}`;
}

/**
 * Canonical app origin for links that leave the app (emails, Stripe redirect
 * URLs). Prefers NEXT_PUBLIC_APP_URL (required for contexts with no meaningful
 * request host, e.g. Stripe webhooks); falls back to the request headers.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    return host ? `${proto}://${host}` : "";
  } catch {
    return "";
  }
}

/** Absolute URL of the public order page, for emails and Stripe redirects. */
export async function publicOrderUrl(token: string): Promise<string> {
  const origin = await appOrigin();
  return `${origin}${publicOrderPath(token)}`;
}
