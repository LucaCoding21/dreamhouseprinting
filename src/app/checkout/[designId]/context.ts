import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { isProvinceCode, type ProvinceCode } from "@/lib/pricing/tax";
import { mergeCheckoutSettings, type CheckoutSettings } from "@/lib/checkoutSettings";
import type { CheckoutSummary } from "./OrderSummary";

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
}

function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Loads everything both checkout steps need from a saved design + the customer's
 * profile: the order summary, the prefilled contact form, and the province (for
 * tax). Returns null if the design doesn't exist or isn't this customer's.
 */
export async function loadCheckoutContext(
  designId: string,
  userId: string,
  userEmail: string | null,
): Promise<CheckoutContext | null> {
  const service = requireSupabaseServiceClient();

  const { data: design } = await service
    .from("designs")
    .select("id, name, colour, size_quantities, price_snapshot, mockup_images, product_id, lead_email")
    .eq("id", designId)
    .eq("customer_id", userId)
    .single();
  if (!design) return null;

  const { data: product } = design.product_id
    ? await service.from("products").select("name, brand").eq("id", design.product_id).single()
    : { data: null };

  const { data: profile } = await service
    .from("profiles")
    .select("name, phone, email, addresses")
    .eq("id", userId)
    .single();

  const { data: checkoutSetting } = await service
    .from("settings")
    .select("value")
    .eq("key", "checkout")
    .maybeSingle();

  const snap = (design.price_snapshot ?? {}) as PriceSnapshot;
  const colour = (design.colour ?? {}) as ColourJson;
  const sizes = (design.size_quantities ?? {}) as Record<string, number>;
  const mockups = (design.mockup_images ?? []) as MockupJson[];
  const quantity = Object.values(sizes).reduce((s, n) => s + (Number(n) > 0 ? Number(n) : 0), 0);

  const summary: CheckoutSummary = {
    designName: design.name ?? "Your design",
    productName: product?.name ?? "Custom item",
    brand: product?.brand ?? null,
    colourName: colour.name ?? null,
    colourHex: colour.hex ?? null,
    sizeBreakdown: Object.entries(sizes)
      .filter(([, n]) => Number(n) > 0)
      .map(([size, n]) => ({ size, qty: Number(n) })),
    quantity,
    mockupUrl: mockups.find((m) => m.url)?.url ?? null,
    subtotal: Number(snap.subtotal ?? 0),
    setup: Number(snap.setupTotal ?? 0),
  };

  const addr = (((profile?.addresses ?? []) as AddressJson[])[0] ?? {}) as AddressJson;
  const { first, last } = splitName(addr.name || profile?.name);
  const contact: CheckoutContact = {
    firstName: first,
    lastName: last,
    email: design.lead_email || profile?.email || userEmail || "",
    phone: addr.phone || profile?.phone || "",
    company: addr.company || "",
    street: addr.street || "",
    city: addr.city || "",
    province: addr.prov || "",
    postal: addr.postal || "",
  };

  return {
    designId: design.id,
    summary,
    contact,
    province: isProvinceCode(addr.prov) ? addr.prov : null,
    hasAddress: !!(addr.street && addr.prov),
    checkout: mergeCheckoutSettings(checkoutSetting?.value),
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
export async function loadReviewContext(
  designId: string,
  userId: string,
  userEmail: string | null,
): Promise<ReviewContext | null> {
  const base = await loadCheckoutContext(designId, userId, userEmail);
  if (!base) return null;
  const service = requireSupabaseServiceClient();

  const { data: design } = await service
    .from("designs")
    .select("decoration_method_id, print_area_ids, price_snapshot, product_id")
    .eq("id", designId)
    .eq("customer_id", userId)
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
