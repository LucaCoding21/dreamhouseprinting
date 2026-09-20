"use server";

import { getUser } from "@/lib/auth";
import { getOrCreateGuestToken } from "@/lib/guest";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { sendDesignSavedEmail } from "@/lib/notify";
import type { Json } from "@/lib/db/types";

const asJson = (v: unknown) => v as unknown as Json;
const YEAR = 60 * 60 * 24 * 365;

/** Who owns a design, a logged-in customer, or a guest browser by cookie token. */
type DesignOwner = { userId: string } | { guestToken: string };

export interface DesignColorway {
  colourName: string;
  colourHex?: string;
  sizeQuantities: Record<string, number>;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface DesignSubmitInput {
  productId: string;
  /** Customer-given name for the design (collected in the save-your-design modal). */
  name?: string;
  /** Lead email captured at save time, may differ from the account email. */
  leadEmail?: string;
  colourName: string;
  colourHex?: string;
  sizeQuantities: Record<string, number>;
  /** Every garment colourway ordered (same artwork). The first mirrors the
   *  legacy colour/sizeQuantities above; downstream creates one line item each. */
  colorways: DesignColorway[];
  decorationMethodId: string | null;
  printAreaIds: string[];
  /** Fabric scene JSON per view. Image srcs must NOT be data URLs, the client
   *  stages those to Storage and sends `dh-staged:<path>` markers instead (big
   *  photos/PDF pages as data URLs blew the server-action body limit). */
  scenes: Record<string, unknown>;
  /** Storage objects backing the `dh-staged:` markers inside `scenes`. */
  sceneImages?: { bucket: string; path: string }[];
  mockups: { view: string; bucket: string; path: string }[];
  artwork: { name: string; bucket: string; path: string }[];
  priceSnapshot: {
    unitPrice: number;
    subtotal: number;
    setupTotal: number;
    total: number;
    quantity: number;
    /** Rush request. New designs store the chosen tier ({days, pct, fee});
     *  designs saved before rush tiers existed carry the legacy flat-rush
     *  boolean, which placeOrderAction still understands. */
    rush?: boolean | { days: number; pct: number; fee: number };
    /** Requested in-hand date (YYYY-MM-DD) from the "Pick a date" rush option.
     *  A date alone adds no fee, the shop confirms the timeline. */
    neededBy?: string | null;
    /** Free-text note the customer left in the designer ("Leave a note").
     *  Copied to orders.production_notes.customer when the order is placed. */
    customerNote?: string | null;
    /** Colour count the estimate was priced with (artist confirms at proofing). */
    inkColours?: number;
    /** Print spec derived in the designer, ONE ENTRY PER DECORATED ZONE (real
     *  measurement + colour count). A side can carry several zones, e.g. a left
     *  chest beside a full front, and each is its own print. Pre-fills the admin
     *  decoration sheet on order placement. */
    decorationSpots?: {
      view: string;
      location: string;
      type: string;
      widthIn: string;
      heightIn: string;
      colours: string;
    }[];
  };
  notes?: string;
  asQuote?: boolean;
  designId?: string;
}

/** Storage-path prefix the caller is allowed to reference. Mirrors the prefix
 *  minted in /api/design/upload: `${userId}/…` for members, `guest/${token}/…`
 *  for guests. Any path outside it belongs to someone else. */
function ownerPathPrefix(owner: DesignOwner): string {
  return "userId" in owner ? `${owner.userId}/` : `guest/${owner.guestToken}/`;
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

/** Replace `dh-staged:<path>` image markers in Fabric scene JSON with signed
 *  URLs (recursing into groups). Mutates the scene objects in place. */
function rewriteStagedSrcs(node: unknown, urlOfPath: (path: string) => string | null): void {
  if (Array.isArray(node)) {
    node.forEach((n) => rewriteStagedSrcs(n, urlOfPath));
    return;
  }
  if (node && typeof node === "object") {
    const rec = node as Record<string, unknown>;
    if (typeof rec.src === "string" && rec.src.startsWith("dh-staged:")) {
      const url = urlOfPath(rec.src.slice("dh-staged:".length));
      if (url) rec.src = url;
    }
    if (Array.isArray(rec.objects)) rewriteStagedSrcs(rec.objects, urlOfPath);
  }
}

/** Persist a Design (draft or submitted) with its mockups + artwork. Shared by save + submit. */
async function persistDesign(
  service: ReturnType<typeof requireSupabaseServiceClient>,
  owner: DesignOwner,
  input: DesignSubmitInput,
  status: "draft" | "submitted"
): Promise<{ id: string; created: boolean; mockupUrl: string | null }> {
  const sceneImages = input.sceneImages ?? [];
  // Only sign storage paths this caller actually owns. Without this guard the
  // client could hand us any path (another customer's artwork, a staff proof)
  // and we would mint a year-long signed URL for it.
  const prefix = ownerPathPrefix(owner);
  const referenced = [...input.mockups, ...input.artwork, ...sceneImages];
  if (referenced.some((it) => !it.path.startsWith(prefix))) {
    throw new Error("Those uploaded files could not be verified. Please re-upload and try again.");
  }
  const signed = await signAll(service, referenced);
  const mockupImages = input.mockups.map((m) => ({ view: m.view, path: m.path, url: signed[m.path] ?? null }));
  const sourceArtwork = input.artwork.map((a) => ({ name: a.name, path: a.path, url: signed[a.path] ?? null }));
  const mockupUrl = mockupImages.find((m) => m.url)?.url ?? null;
  // Point staged scene images at their (year-long) signed URLs so the canvas
  // can rehydrate the design later.
  Object.values(input.scenes ?? {}).forEach((scene) => rewriteStagedSrcs(scene, (p) => signed[p] ?? null));

  const isUser = "userId" in owner;
  const row = {
    product_id: input.productId,
    customer_id: isUser ? owner.userId : null,
    guest_token: isUser ? null : owner.guestToken,
    name: input.name?.trim() || null,
    lead_email: input.leadEmail?.trim() || null,
    scene_definition: asJson(input.scenes),
    mockup_images: asJson(mockupImages),
    source_artwork_files: asJson(sourceArtwork),
    colour: asJson({ name: input.colourName, hex: input.colourHex ?? null }),
    size_quantities: asJson(input.sizeQuantities),
    colorways: asJson(input.colorways ?? []),
    decoration_method_id: input.decorationMethodId,
    print_area_ids: input.printAreaIds,
    price_snapshot: asJson(input.priceSnapshot),
    status,
  };

  if (input.designId) {
    const q = service.from("designs").update(row).eq("id", input.designId);
    const scoped = isUser ? q.eq("customer_id", owner.userId) : q.eq("guest_token", owner.guestToken);
    const { data, error } = await scoped.select("id").single();
    if (error) throw new Error(error.message);
    return { id: data.id, created: false, mockupUrl };
  }
  const { data, error } = await service.from("designs").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id, created: true, mockupUrl };
}

export async function saveDraftAction(
  input: DesignSubmitInput
): Promise<{ designId?: string; needsLogin?: boolean; error?: string }> {
  const user = await getUser();
  const service = requireSupabaseServiceClient();
  try {
    if (user) {
      const { id: designId } = await persistDesign(service, { userId: user.id }, input, "draft");
      return { designId };
    }
    // Guest path, proceed with just an email, identified by a cookie token.
    const leadEmail = input.leadEmail?.trim();
    if (!leadEmail) return { error: "Enter your email to continue." };
    const guestToken = await getOrCreateGuestToken();
    const { id: designId, created, mockupUrl } = await persistDesign(service, { guestToken }, input, "draft");

    // Send the "your design is saved" email, only on first save (a new row),
    // and never let an email failure fail the save the customer just made.
    if (created) {
      try {
        const { data: product } = await service
          .from("products")
          .select("name")
          .eq("id", input.productId)
          .maybeSingle();
        await sendDesignSavedEmail({
          to: leadEmail,
          designName: input.name?.trim() ?? "",
          productName: product?.name ?? "custom",
          designId,
          guestToken,
          mockupUrl,
        });
      } catch (e) {
        console.error("[design] saved-email failed", e);
      }
    }
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
    const { id: designId } = await persistDesign(service, { userId: user.id }, input, "submitted");

    // Quote path, staff price it later.
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

    // Pre-fill the admin decoration sheet from the designer-derived spec.
    const spots = (input.priceSnapshot.decorationSpots ?? []).map((s) => ({
      location: s.location || s.view,
      type: s.type,
      widthIn: s.widthIn,
      heightIn: s.heightIn,
      colours: s.colours,
      pantones: [] as string[],
      puff: false,
      spotProcess: false,
    }));
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
      ...(spots.length
        ? { decorations: asJson({ spots, bagging: false, sewnTags: false, priceConfirmed: false }) }
        : {}),
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
