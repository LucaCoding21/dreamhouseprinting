"use server";

import { getUser } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/db/types";

const asJson = (v: unknown) => v as unknown as Json;
const YEAR = 60 * 60 * 24 * 365;

export interface DesignSubmitInput {
  productId: string;
  colourName: string;
  colourHex?: string;
  sizeQuantities: Record<string, number>;
  decorationMethodId: string | null;
  printAreaIds: string[];
  scenes: Record<string, unknown>;
  mockups: { view: string; bucket: string; path: string }[];
  artwork: { name: string; bucket: string; path: string }[];
  priceSnapshot: {
    unitPrice: number;
    subtotal: number;
    setupTotal: number;
    total: number;
    quantity: number;
    rush?: boolean;
  };
  notes?: string;
  asQuote?: boolean;
  designId?: string;
}

async function signAll(
  service: ReturnType<typeof requireSupabaseServiceClient>,
  items: { bucket: string; path: string }[]
) {
  const out: Record<string, string> = {};
  for (const it of items) {
    const { data } = await service.storage.from(it.bucket).createSignedUrl(it.path, YEAR);
    if (data?.signedUrl) out[it.path] = data.signedUrl;
  }
  return out;
}

/** Persist a Design (draft or submitted) with its mockups + artwork. Shared by save + submit. */
async function persistDesign(
  service: ReturnType<typeof requireSupabaseServiceClient>,
  userId: string,
  input: DesignSubmitInput,
  status: "draft" | "submitted"
) {
  const signed = await signAll(service, [...input.mockups, ...input.artwork]);
  const mockupImages = input.mockups.map((m) => ({ view: m.view, path: m.path, url: signed[m.path] ?? null }));
  const sourceArtwork = input.artwork.map((a) => ({ name: a.name, path: a.path, url: signed[a.path] ?? null }));

  const row = {
    product_id: input.productId,
    customer_id: userId,
    scene_definition: asJson(input.scenes),
    mockup_images: asJson(mockupImages),
    source_artwork_files: asJson(sourceArtwork),
    colour: asJson({ name: input.colourName, hex: input.colourHex ?? null }),
    size_quantities: asJson(input.sizeQuantities),
    decoration_method_id: input.decorationMethodId,
    print_area_ids: input.printAreaIds,
    price_snapshot: asJson(input.priceSnapshot),
    status,
  };

  if (input.designId) {
    const { data, error } = await service
      .from("designs")
      .update(row)
      .eq("id", input.designId)
      .eq("customer_id", userId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  }
  const { data, error } = await service.from("designs").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function saveDraftAction(
  input: DesignSubmitInput
): Promise<{ designId?: string; needsLogin?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { needsLogin: true };
  const service = requireSupabaseServiceClient();
  try {
    const designId = await persistDesign(service, user.id, input, "draft");
    return { designId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save draft" };
  }
}

export async function submitDesignAction(
  input: DesignSubmitInput
): Promise<{ orderId?: string; orderNumber?: string; quoteId?: string; needsLogin?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { needsLogin: true };
  const service = requireSupabaseServiceClient();

  try {
    const designId = await persistDesign(service, user.id, input, "submitted");

    // Quote path — staff price it later.
    if (input.asQuote) {
      const { data: q, error } = await service
        .from("quotes")
        .insert({
          customer_id: user.id,
          design_ids: [designId],
          line_items: asJson([]),
          pricing: asJson(input.priceSnapshot),
          message: input.notes ?? null,
          status: "requested",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { quoteId: q.id };
    }

    // Order path.
    const { data: product } = await service
      .from("products")
      .select("name, lead_time_days")
      .eq("id", input.productId)
      .single();
    const lead = product?.lead_time_days ?? 7;
    const due = new Date();
    due.setDate(due.getDate() + lead);

    const { data: order, error: orderErr } = await service
      .from("orders")
      .insert({
        customer_id: user.id,
        status: "submitted",
        payment_status: "unpaid",
        pricing: asJson({
          subtotal: input.priceSnapshot.subtotal,
          setupFees: input.priceSnapshot.setupTotal,
          shipping: 0,
          tax: 0,
          total: input.priceSnapshot.total,
        }),
        due_date: due.toISOString().slice(0, 10),
        customer_notes: input.notes ? asJson([{ at: new Date().toISOString(), actor: "customer", text: input.notes }]) : asJson([]),
      })
      .select("id, order_number")
      .single();
    if (orderErr) throw new Error(orderErr.message);

    const { error: liErr } = await service.from("line_items").insert({
      order_id: order.id,
      product_id: input.productId,
      design_id: designId,
      product_name: product?.name ?? null,
      colour: asJson({ name: input.colourName, hex: input.colourHex ?? null }),
      size_quantities: asJson(input.sizeQuantities),
      decoration_method_id: input.decorationMethodId,
      unit_price: input.priceSnapshot.unitPrice,
      setup_fee: input.priceSnapshot.setupTotal,
      line_total: input.priceSnapshot.total,
    });
    if (liErr) throw new Error(liErr.message);

    await service.from("order_activity").insert({
      order_id: order.id,
      actor_id: user.id,
      actor_name: "Customer",
      type: "order_created",
      detail: asJson({ via: "designer" }),
    });

    return { orderId: order.id, orderNumber: order.order_number ?? undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not submit" };
  }
}
