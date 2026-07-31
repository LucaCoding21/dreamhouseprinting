"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { ssSearchStyles } from "@/lib/ss/client";
import { buildProductDraft } from "@/lib/ss/transform";
import type { SSStyle } from "@/lib/ss/types";
import { ssImageUrl } from "@/lib/ss/client";
import type { Json, Database } from "@/lib/db/types";
import type { PricingProfileRow, ProductRow } from "@/lib/db/rows";
import { buildProductPricingRules } from "@/lib/admin/pricing";
import { pickProfileForStyle, hasQuoteCurve } from "@/lib/admin/priceListMatch";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

/** S&S draft structs are typed interfaces; cast to Json at the jsonb column boundary. */
const asJson = (v: unknown) => v as unknown as Json;

/**
 * Turn a raw S&S/HTTP error into copy a non-technical admin can act on.
 * Keeps the raw message in the server log for debugging.
 */
function friendlySsError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  console.error("[S&S]", raw);
  if (/not configured|SS_ACCOUNT|SS_API_KEY/i.test(raw)) {
    return "S&S Activewear isn't connected yet, add SS_ACCOUNT and SS_API_KEY to the environment.";
  }
  return "Couldn't reach S&S Activewear. Try again in a minute.";
}

/** Search the S&S catalog (staff, products.manage). Returns a trimmed result set. */
export async function ssSearchAction(query: string): Promise<{
  results?: { styleID: number; brand: string; styleName: string; title: string; image: string | null }[];
  error?: string;
}> {
  await requirePermission("products.manage");
  if (!query || query.trim().length < 2) return { results: [] };
  try {
    const styles: SSStyle[] = await ssSearchStyles(query.trim());
    const results = styles.slice(0, 40).map((s) => ({
      styleID: s.styleID,
      brand: s.brandName,
      styleName: s.styleName,
      title: s.title,
      image: ssImageUrl(s.styleImage),
    }));
    return { results };
  } catch (e) {
    return { error: friendlySsError(e) };
  }
}

/** Import an S&S style as a shop Product (or return the existing one if already imported). */
export async function importStyleAction(styleId: number): Promise<{ productId?: string; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();

  // Already imported? Return it.
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("ss_style_id", String(styleId))
    .maybeSingle();
  if (existing) return { productId: existing.id };

  try {
    const draft = await buildProductDraft(styleId);

    // Every product gets a price list the moment it exists. A product without
    // one used to price through a cost-plus fallback that could quote far below
    // cost, so the fix is to make "no price" unreachable rather than to handle
    // it. Staff can change the list in the editor; they can never end up with
    // none. Falls back to the first list if nothing matches, so even an
    // unrecognised category is priced.
    const { data: allProfiles } = await supabase.from("pricing_profiles").select("*");
    const profileRow = pickProfileForStyle(
      (allProfiles ?? []) as PricingProfileRow[],
      `${draft.name} ${draft.baseCategory ?? ""}`,
    );

    // Default allowed decoration methods = all active methods (admin narrows later).
    const { data: methods } = await supabase
      .from("decoration_methods")
      .select("id")
      .eq("is_active", true);
    const allowed = (methods ?? []).map((m) => m.id);

    const { data, error } = await supabase
      .from("products")
      .insert({
        ss_style_id: draft.ssStyleId,
        ss_part_number: draft.ssPartNumber,
        ss_style_name: draft.ssStyleName,
        ss_last_synced_at: new Date().toISOString(),
        brand: draft.brand,
        name: draft.name,
        description: draft.description,
        photos: asJson(draft.photos),
        colours: asJson(draft.colours),
        sizes: asJson(draft.sizes),
        wholesale_cost: draft.wholesaleCost,
        stock_status: draft.stockStatus,
        markup_type: "percent",
        markup_value: 100,
        pricing_rules: asJson(
          buildProductPricingRules(
            {
              wholesale_cost: draft.wholesaleCost,
              base_price: null,
              markup_type: "percent",
              markup_value: 100,
              pricing_rules: null,
            } as Pick<ProductRow, "wholesale_cost" | "base_price" | "markup_type" | "markup_value" | "pricing_rules">,
            profileRow,
          ),
        ),
        allowed_decoration_method_ids: allowed,
        lead_time_days: 7,
        is_active: false, // staff activate after configuring category + print areas
        is_featured: false,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    revalidatePath("/admin/products");
    return { productId: data.id };
  } catch (e) {
    return { error: friendlySsError(e) };
  }
}

export interface ProductConfigInput {
  name?: string;
  description?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  basePrice?: number | null;
  markupType?: "percent" | "flat";
  markupValue?: number;
  allowedDecorationMethodIds?: string[];
  leadTimeDays?: number;
  stockStatus?: "in_stock" | "out_of_stock" | "made_to_order";
  enabledColours?: string[]; // names of S&S colours the shop offers (subset)
  enabledSizes?: string[];   // names of S&S sizes offered (subset)
  thumbnailColour?: string | null; // colour pinned as the card thumbnail (null = auto)
  thumbnailView?: "model" | "flat"; // which of the pinned colour's shots to show (default: model)
  // Shared decoration pricing profile: the customer curve is compiled from this
  // profile + the product's blank. undefined = leave unchanged; null = detach
  // (fall back to blank retail); a string id = use that profile.
  profileId?: string | null;
}

/** Update Admin-owned product configuration. S&S-owned fields are not touched here. */
export async function updateProductAction(
  id: string,
  input: ProductConfigInput
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();

  const patch: ProductUpdate = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.subcategoryId !== undefined) patch.subcategory_id = input.subcategoryId;
  if (input.basePrice !== undefined) patch.base_price = input.basePrice;
  if (input.markupType !== undefined) patch.markup_type = input.markupType;
  if (input.markupValue !== undefined) patch.markup_value = input.markupValue;
  if (input.allowedDecorationMethodIds !== undefined)
    patch.allowed_decoration_method_ids = input.allowedDecorationMethodIds;
  if (input.leadTimeDays !== undefined) patch.lead_time_days = input.leadTimeDays;
  if (input.stockStatus !== undefined) patch.stock_status = input.stockStatus;

  // Customer pricing: compile the curve from the chosen shared profile + this
  // product's blank, and stamp it (plus profileId) onto pricing_rules.quote so
  // every storefront/designer/order surface keeps reading the same shape.
  if (input.profileId !== undefined) {
    const { data: prod } = await supabase
      .from("products")
      .select("wholesale_cost, base_price, markup_type, markup_value, pricing_rules")
      .eq("id", id)
      .single();
    if (prod) {
      // markup edits in this same save affect the compiled shift, so use the
      // incoming markup values (fall back to the stored ones).
      const blank = {
        ...prod,
        markup_type: input.markupType ?? prod.markup_type,
        markup_value: input.markupValue ?? prod.markup_value,
      } as Pick<ProductRow, "wholesale_cost" | "base_price" | "markup_type" | "markup_value" | "pricing_rules">;
      let profileRow: PricingProfileRow | null = null;
      if (input.profileId) {
        const { data: p } = await supabase.from("pricing_profiles").select("*").eq("id", input.profileId).maybeSingle();
        profileRow = (p as PricingProfileRow | null) ?? null;
      }
      patch.pricing_rules = asJson(buildProductPricingRules(blank, profileRow));
    }
  }

  // Colour/size enablement: mark each S&S colour/size with an `enabled` flag, and
  // pin the thumbnail colour with a `primary` flag (only one colour carries it).
  if (input.enabledColours || input.enabledSizes || input.thumbnailColour !== undefined) {
    const { data: prod } = await supabase
      .from("products")
      .select("colours, sizes")
      .eq("id", id)
      .single();
    if (prod) {
      if (input.enabledColours || input.thumbnailColour !== undefined) {
        const enabledSet = input.enabledColours ? new Set(input.enabledColours) : null;
        patch.colours = asJson(
          (prod.colours as unknown as Record<string, unknown>[]).map((c) => {
            const name = c.name as string;
            const out: Record<string, unknown> = { ...c };
            if (enabledSet) out.enabled = enabledSet.has(name);
            if (input.thumbnailColour !== undefined) {
              const isPrimary = name === input.thumbnailColour;
              out.primary = isPrimary;
              // primaryView only rides the pinned colour; clear it elsewhere.
              if (isPrimary && input.thumbnailView === "flat") out.primaryView = "flat";
              else delete out.primaryView;
            }
            return out;
          })
        );
      }
      if (input.enabledSizes) {
        const set = new Set(input.enabledSizes);
        patch.sizes = asJson(
          (prod.sizes as unknown as { name: string }[]).map((s) => ({ ...s, enabled: set.has(s.name) }))
        );
      }
    }
  }

  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/shop");
  return { ok: true };
}

/** Re-sync S&S-owned fields (price, inventory, colours, sizes, images). Preserves Admin config. */
export async function syncProductAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();

  const { data: prod } = await supabase
    .from("products")
    .select("ss_style_id, colours, sizes")
    .eq("id", id)
    .single();
  if (!prod?.ss_style_id) return { error: "Not an S&S-sourced product" };

  try {
    const draft = await buildProductDraft(prod.ss_style_id);

    // Preserve the admin `enabled` flags and the pinned thumbnail (`primary` + `primaryView`) across the sync.
    const prevColours = new Map(
      (prod.colours as unknown as { name: string; enabled?: boolean; primary?: boolean; primaryView?: "model" | "flat" }[]).map((c) => [c.name, c])
    );
    const prevSizes = new Map((prod.sizes as unknown as { name: string; enabled?: boolean }[]).map((s) => [s.name, s.enabled]));
    const colours = draft.colours.map((c) => {
      const prev = prevColours.get(c.name);
      return {
        ...c,
        enabled: prev?.enabled ?? true,
        ...(prev?.primary ? { primary: true } : {}),
        ...(prev?.primary && prev.primaryView ? { primaryView: prev.primaryView } : {}),
      };
    });
    const sizes = draft.sizes.map((s) => ({ ...s, enabled: prevSizes.get(s.name) ?? true }));

    // Note: name & description are deliberately NOT updated, they may be
    // admin-edited. Only refresh the S&S-owned media/price/inventory fields.
    const { error } = await supabase
      .from("products")
      .update({
        photos: asJson(draft.photos),
        colours: asJson(colours),
        sizes: asJson(sizes),
        wholesale_cost: draft.wholesaleCost,
        stock_status: draft.stockStatus,
        ss_style_name: draft.ssStyleName,
        ss_last_synced_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sync failed" };
  }
}

export async function setProductFlagsAction(
  id: string,
  flags: { isActive?: boolean; isFeatured?: boolean }
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();

  // Going live requires a price. Nothing else in the system checks this, and
  // an active product with no curve is exactly the case the deleted cost-plus
  // fallback used to paper over with a near-free number.
  if (flags.isActive) {
    const { data: row } = await supabase.from("products").select("pricing_rules").eq("id", id).maybeSingle();
    if (!hasQuoteCurve(row?.pricing_rules)) {
      return { error: "Pick a price list for this product before making it live." };
    }
  }

  const patch: ProductUpdate = {};
  if (flags.isActive !== undefined) patch.is_active = flags.isActive;
  if (flags.isFeatured !== undefined) patch.is_featured = flags.isFeatured;

  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { ok: true };
}

export interface PrintAreaInput {
  id?: string;
  name: string;
  view: "front" | "back" | "left_sleeve" | "right_sleeve" | "sleeve";
  position: { x: number; y: number; width: number; height: number };
  maxWidthIn: number;
  maxHeightIn: number;
  pxPerInch: number;
  displayOrder: number;
}

/** Replace a product's print areas with the supplied set. */
export async function savePrintAreasAction(
  productId: string,
  areas: PrintAreaInput[]
): Promise<{ ok?: boolean; error?: string }> {
  await requirePermission("products.manage");
  const supabase = requireSupabaseServiceClient();

  // Replace-all: delete existing, insert new (simple + correct for a small set).
  const { error: delErr } = await supabase.from("print_areas").delete().eq("product_id", productId);
  if (delErr) return { error: delErr.message };

  if (areas.length) {
    const rows = areas.map((a) => ({
      product_id: productId,
      name: a.name,
      view: a.view,
      position: asJson(a.position),
      max_width_in: a.maxWidthIn,
      max_height_in: a.maxHeightIn,
      px_per_inch: a.pxPerInch,
      display_order: a.displayOrder,
    }));
    const { error } = await supabase.from("print_areas").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/products/${productId}`);
  return { ok: true };
}
