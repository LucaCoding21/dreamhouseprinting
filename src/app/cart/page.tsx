import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getUser } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { mergeBusinessSettings, pickupAddress } from "@/lib/businessSettings";
import { CartClient, type CartPrefill } from "./CartClient";

export const metadata = { title: "Your cart | Dreamhouse Printing" };

interface AddressJson {
  name?: string;
  phone?: string;
  company?: string;
  street?: string;
  city?: string;
  prov?: string;
  postal?: string;
}

function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

const EMPTY: CartPrefill = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  street: "",
  city: "",
  province: "",
  postal: "",
};

/** Cart shell, loads any saved profile contact to prefill the request form,
 *  then hands off to the client cart (which owns the localStorage items). */
export default async function CartPage() {
  const user = await getUser();
  let prefill: CartPrefill = EMPTY;

  // Pickup address is shown at checkout when the customer chooses "Pick up".
  const service = requireSupabaseServiceClient();
  const { data: businessRow } = await service
    .from("settings")
    .select("value")
    .eq("key", "business")
    .maybeSingle();
  const shopPickupAddress = pickupAddress(mergeBusinessSettings(businessRow?.value));

  if (user) {
    const { data: profile } = await service
      .from("profiles")
      .select("name, phone, email, addresses")
      .eq("id", user.id)
      .single();
    const addr = (((profile?.addresses ?? []) as AddressJson[])[0] ?? {}) as AddressJson;
    const { first, last } = splitName(addr.name || profile?.name);
    prefill = {
      firstName: first,
      lastName: last,
      email: profile?.email || user.email || "",
      phone: addr.phone || profile?.phone || "",
      company: addr.company || "",
      street: addr.street || "",
      city: addr.city || "",
      province: addr.prov || "",
      postal: addr.postal || "",
    };
  }

  return (
    <div className="min-h-screen bg-[#f8f7fd] text-dream-ink">
      <SiteNav />
      <CartClient prefill={prefill} pickupAddress={shopPickupAddress} />
      <SiteFooter />
    </div>
  );
}
