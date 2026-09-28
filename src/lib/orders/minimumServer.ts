import "server-only";

import { unstable_cache } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { mergeBusinessSettings } from "@/lib/businessSettings";

/** Cache tag busted by the admin settings save (updateTag). */
export const MINIMUM_ORDER_TAG = "order-minimum";

/**
 * The live minimum order quantity (see lib/orders/minimum.ts). Cached so the
 * root layout can read it without turning every static marketing page
 * dynamic; saving Settings -> Checkout busts the tag and revalidates pages.
 */
export const getMinimumOrderQty = unstable_cache(
  async (): Promise<number> => {
    const service = createSupabaseServiceClient();
    if (!service) return mergeBusinessSettings(null).minimumOrderQty;
    const { data } = await service.from("settings").select("value").eq("key", "business").maybeSingle();
    return mergeBusinessSettings(data?.value).minimumOrderQty;
  },
  [MINIMUM_ORDER_TAG],
  { tags: [MINIMUM_ORDER_TAG] },
);
