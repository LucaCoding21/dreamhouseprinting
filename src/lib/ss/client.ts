import "server-only";

import type { SSStyle, SSProduct, SSSpec } from "./types";

/**
 * Low-level S&S Activewear v2 client. HTTP Basic auth (account number : api key),
 * SERVER-ONLY (credentials must never reach the browser). Canadian account →
 * api-ca.ssactivewear.com. Override the region with SS_BASE_URL if ever needed.
 */
const BASE_URL = (process.env.SS_BASE_URL ?? "https://api-ca.ssactivewear.com/v2").replace(/\/$/, "");
export const SS_CDN = "https://cdn.ssactivewear.com";

export function ssConfigured() {
  return Boolean(process.env.SS_ACCOUNT && process.env.SS_API_KEY);
}

function authHeader() {
  const account = process.env.SS_ACCOUNT ?? "";
  const key = process.env.SS_API_KEY ?? "";
  return "Basic " + Buffer.from(`${account}:${key}`).toString("base64");
}

async function ssGet<T>(
  path: string,
  params?: Record<string, string>,
  opts?: { revalidate?: number },
): Promise<T> {
  if (!ssConfigured()) {
    throw new Error("S&S API not configured (SS_ACCOUNT / SS_API_KEY missing)");
  }
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${BASE_URL}${path}${qs}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
    // Catalog data changes slowly; let route handlers decide caching. Default no-store
    // so admin always sees fresh inventory/price on sync. Callers that read
    // slow-moving reference data (size specs) opt into revalidate-based caching.
    ...(opts?.revalidate ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" as const }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`S&S ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Convert a CDN-relative image path to an absolute URL (or null if empty). */
export function ssImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${SS_CDN}/${path.replace(/^\//, "")}`;
}

/** Search styles by free text (brand, style number, name). */
export function ssSearchStyles(query: string): Promise<SSStyle[]> {
  return ssGet<SSStyle[]>("/styles/", { search: query });
}

/** Fetch a single style by its numeric styleID. */
export async function ssGetStyle(styleId: string | number): Promise<SSStyle | null> {
  const data = await ssGet<SSStyle[] | SSStyle>(`/styles/${styleId}`);
  const style = Array.isArray(data) ? data[0] : data;
  return style ?? null;
}

/** Fetch all SKU-level products (colour×size) for a style. */
export function ssGetProducts(styleId: string | number): Promise<SSProduct[]> {
  return ssGet<SSProduct[]>("/products/", { style: String(styleId) });
}

/** Fetch per-size measurement specs for a style (size guide). Cached for a day. */
export function ssGetSpecs(styleId: string | number): Promise<SSSpec[]> {
  return ssGet<SSSpec[]>("/specs/", { style: String(styleId) }, { revalidate: 86400 });
}
