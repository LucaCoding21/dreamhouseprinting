import { getUser } from "@/lib/auth";
import { getGuestToken } from "@/lib/guest";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { isProvinceCode, type ProvinceCode } from "@/lib/pricing/tax";
import { mergeCheckoutSettings, type CheckoutSettings } from "@/lib/checkoutSettings";
import type { CheckoutSummary, SummaryColorway } from "./OrderSummary";

interface PriceSnapshot {
  unitPrice?: number;
  subtotal?: number;
  setupTotal?: number;
  total?: number;
  quantity?: number;
}
interface ColourJson {
  name?: string;
  hex?: string | null;
}
interface StoredColorway {
  colourName?: string;
  colourHex?: string | null;
  sizeQuantities?: Record<string, number>;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
}
interface MockupJson {
  view?: string;
  url?: string | null;
}
interface AddressJson {
  name?: string;
  company?: string;
  phone?: string;
  street?: string;
  city?: string;
  prov?: string;
  postal?: string;
  country?: string;
}

function breakdownOf(sizes: Record<string, number>): { size: string; qty: number }[] {
  return Object.entries(sizes)
    .filter(([, n]) => Number(n) > 0)
    .map(([size, n]) => ({ size, qty: Number(n) }));
}

export interface CheckoutContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  street: string;
  city: string;
  province: string;
  postal: string;
}

export interface CheckoutContext {
  designId: string;
  summary: CheckoutSummary;
  province: ProvinceCode | null;
  contact: CheckoutContact;
  hasAddress: boolean;
  checkout: CheckoutSettings;
  isGuest: boolean;
}

export interface CheckoutAuth {
  isGuest: boolean;
  userId: string | null;
  guestToken: string | null;
  userEmail: string | null;
}

function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Authorize the current request for a design: it must belong to the logged-in
 * user (customer_id) OR to this browser's guest cookie (guest_token). Returns
 * null when neither matches — the design id alone never grants access.
 */
export async function resolveCheckoutAuth(designId: string): Promise<CheckoutAuth | null> {
  const service = requireSupabaseServiceClient();
  const [user, guestToken] = await Promise.all([getUser(), getGuestToken()]);

  const { data: design } = await service
    .from("designs")
    .select("customer_id, guest_token")
    .eq("id", designId)
    .single();
  if (!design) return null;

  if (user && design.customer_id === user.id) {
    return { isGuest: false, userId: user.id, guestToken: null, userEmail: user.email ?? null };
  }
  if (guestToken && design.guest_token && design.guest_token === guestToken) {
    return { isGuest: true, userId: null, guestToken, userEmail: null };
  }
  return null;
}

/**
 * Loads everything both checkout steps need from a saved design: the order
 * summary, the prefilled contact form, and the province (for tax). Contact comes
 * from the customer's profile when logged in, or the design's guest_contact for
 * guests. Returns null if the requester isn't authorized for the design.
 */
export async function loadCheckoutContext(designId: string): Promise<CheckoutContext | null> {
  const auth = await resolveCheckoutAuth(designId);
  if (!auth) return null;
  const service = requireSupabaseServiceClient();

  const { data: design } = await service
    .from("designs")
    .select("id, name, colour, colorways, size_quantities, price_snapshot, mockup_images, product_id, lead_email, guest_contact")
    .eq("id", designId)
    .single();
  if (!design) return null;

  const { data: product } = design.product_id
    ? await service.from("products").select("name, brand").eq("id", design.product_id).single()
    : { data: null };

  const { data: profile } = auth.userId
    ? await service.from("profiles").select("name, phone, email, addresses").eq("id", auth.userId).single()
    : { data: null };

  const { data: checkoutSetting } = await service
    .from("settings")
    .select("value")
    .eq("key", "checkout")
    .maybeSingle();

  const snap = (design.price_snapshot ?? {}) as PriceSnapshot;
  const colour = (design.colour ?? {}) as ColourJson;
  const sizes = (design.size_quantities ?? {}) as Record<string, number>;
  const mockups = (design.mockup_images ?? []) as MockupJson[];
  const rawColorways = (design.colorways ?? []) as StoredColorway[];

  // Prefer the stored colourways; fall back to the legacy single colour/sizes
  // for designs saved before multi-colour existed.
  const colorways: SummaryColorway[] = rawColorways.length
    ? rawColorways.map((cw) => ({
        colourName: cw.colourName ?? null,
        colourHex: cw.colourHex ?? null,
        sizeBreakdown: breakdownOf(cw.sizeQuantities ?? {}),
        quantity: Number(cw.quantity ?? 0),
        unitPrice: Number(cw.unitPrice ?? 0),
        lineTotal: Number(cw.lineTotal ?? 0),
      }))
    : [
        {
          colourName: colour.name ?? null,
          colourHex: colour.hex ?? null,
          sizeBreakdown: breakdownOf(sizes),
          quantity: Object.values(sizes).reduce((s, n) => s + (Number(n) > 0 ? Number(n) : 0), 0),
          unitPrice: Number(snap.unitPrice ?? 0),
          lineTotal: Number(snap.subtotal ?? 0),
        },
      ];
  const quantity = colorways.reduce((s, c) => s + c.quantity, 0);

  const summary: CheckoutSummary = {
    designName: design.name ?? "Your design",
    productName: product?.name ?? "Custom item",
    brand: product?.brand ?? null,
    colorways,
    quantity,
    mockupUrl: mockups.find((m) => m.url)?.url ?? null,
    subtotal: Number(snap.subtotal ?? 0),
    setup: Number(snap.setupTotal ?? 0),
  };

  let contact: CheckoutContact;
  let province: ProvinceCode | null;
  if (auth.isGuest) {
    const gc = (design.guest_contact ?? {}) as Partial<CheckoutContact>;
    contact = {
      firstName: gc.firstName || "",
      lastName: gc.lastName || "",
      email: gc.email || design.lead_email || "",
      phone: gc.phone || "",
      company: gc.company || "",
      street: gc.street || "",
      city: gc.city || "",
      province: gc.province || "",
      postal: gc.postal || "",
    };
    province = isProvinceCode(contact.province) ? contact.province : null;
  } else {
    const addr = (((profile?.addresses ?? []) as AddressJson[])[0] ?? {}) as AddressJson;
    const { first, last } = splitName(addr.name || profile?.name);
    contact = {
      firstName: first,
      lastName: last,
      email: design.lead_email || profile?.email || auth.userEmail || "",
      phone: addr.phone || profile?.phone || "",
      company: addr.company || "",
      street: addr.street || "",
      city: addr.city || "",
      province: addr.prov || "",
      postal: addr.postal || "",
    };
    province = isProvinceCode(addr.prov) ? addr.prov : null;
  }

  return {
    designId: design.id,
    summary,
    contact,
    province,
    hasAddress: !!(contact.street && isProvinceCode(contact.province)),
    checkout: mergeCheckoutSettings(checkoutSetting?.value),
    isGuest: auth.isGuest,
  };
}

export interface ReviewContext extends CheckoutContext {
  unitPrice: number;
  decorationMethodName: string | null;
  printLocations: string[];
  leadTimeDays: number;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Everything the order-review step shows on top of the base checkout context:
 *  the line-item decoration detail + the product lead time for the projection. */
export async function loadReviewContext(designId: string): Promise<ReviewContext | null> {
  const base = await loadCheckoutContext(designId);
  if (!base) return null;
  const service = requireSupabaseServiceClient();

  // Already authorized by loadCheckoutContext — safe to fetch by id.
  const { data: design } = await service
    .from("designs")
    .select("decoration_method_id, print_area_ids, price_snapshot, product_id")
    .eq("id", designId)
    .single();

  const snap = (design?.price_snapshot ?? {}) as PriceSnapshot;

  const { data: method } = design?.decoration_method_id
    ? await service.from("decoration_methods").select("name").eq("id", design.decoration_method_id).single()
    : { data: null };

  const areaIds = (design?.print_area_ids ?? []) as string[];
  const { data: areas } = areaIds.length
    ? await service.from("print_areas").select("name, view").in("id", areaIds)
    : { data: [] };

  const { data: product } = design?.product_id
    ? await service.from("products").select("lead_time_days").eq("id", design.product_id).single()
    : { data: null };

  const printLocations = ((areas ?? []) as { name: string | null; view: string | null }[]).map((a) =>
    a.name?.trim() ? a.name : a.view ? cap(a.view.replace(/_/g, " ")) : "—",
  );

  return {
    ...base,
    unitPrice: Number(snap.unitPrice ?? 0),
    decorationMethodName: method?.name ?? null,
    printLocations: printLocations.length ? printLocations : ["Front"],
    leadTimeDays: product?.lead_time_days ?? 10,
  };
}
