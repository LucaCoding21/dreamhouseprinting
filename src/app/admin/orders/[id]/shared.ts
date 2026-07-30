"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCAD } from "@/lib/money";
import { defaultDecoration, priceFromCurve } from "@/lib/pricing/quote";
import {
  embroiderySizeSurcharge,
  type DecorationPricingSettings,
} from "@/lib/pricing/decorationPricing";
import { uploadProofsAction } from "../actions";
import type { DecorationSpot } from "../actions";
import type { LineProductionStatus } from "@/lib/lineProduction";
import type { Json } from "@/lib/db/types";
import type {
  OrderRow,
  LineItemRow,
  DesignRow,
  ProofRow,
  OrderActivityRow,
  ProfileRow,
  OrderStatus,
  ProductColourJson,
  ProductQuoteCurveJson,
  QuoteDecoration,
} from "@/lib/db/rows";

export interface OrderProduct {
  id: string;
  name: string;
  brand: string | null;
  ss_style_name: string | null;
  ss_style_id: string | null;
  /** Per-colour S&S blank images, for pulling the exact blank garment per line. */
  colours: ProductColourJson[] | null;
  /** Customer price curve (`pricing_rules.quote`), the source for line repricing. */
  pricing_rules: Json | null;
}

export interface Detail {
  order: OrderRow;
  customer: Pick<ProfileRow, "id" | "name" | "email" | "phone"> | null;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  products: OrderProduct[];
  proofs: ProofRow[];
  activity: OrderActivityRow[];
  /** Admin-tuned decoration surcharges (settings key "decoration_pricing"). */
  decorationPricing: DecorationPricingSettings;
}

export interface Can {
  edit: boolean;
  pricing: boolean;
  proofs: boolean;
}

export interface Note {
  at: string;
  actor: string;
  text: string;
}

export interface StoredAddress {
  name?: string;
  company?: string | null;
  phone?: string;
  street?: string;
  city?: string;
  prov?: string;
  postal?: string;
}

export interface ItemState {
  id: string;
  productName: string;
  sizes: [string, number][];
  unitPrice: string;
  spots: DecorationSpot[];
  bagging: boolean;
  sewnTags: boolean;
  priceConfirmed: boolean;
  productionStatus: LineProductionStatus;
  customerNotes: string;
  productionNotes: string;
  internalNotes: string;
  shippingNotes: string;
  /** Blanks for this line are in hand (ordered and received). */
  fulfilled: boolean;
  /** Where the blanks are coming from; "" until Julian picks one. */
  supplier: string;
  /** Stale-price nudge from a product swap; null once applied or dismissed. */
  priceSuggestion: { unit: number; qty: number } | null;
  /**
   * The unit price on this line was just recomputed from the product's curve
   * after a pricing-relevant edit (sizes, colours, prints). Display-only, so the
   * admin can see the number is suggested; typing over the price clears it.
   */
  autoPrice?: { unit: number; qty: number } | null;
}

export const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

/** Blank suppliers Julian buys from. Stored as the plain label on the line. */
export const SUPPLIER_OPTIONS = ["S&S Activewear", "SanMar", "Alphabroder", "Stormtech", "Other"];

export const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

/** Tiny uppercase field label, matching the wireframe. */
export const LBL = "text-[11px] font-semibold uppercase tracking-wide text-dream-muted";

export function sizeRank(s: string): number {
  const i = SIZE_ORDER.indexOf(s.toUpperCase());
  return i === -1 ? 99 : i;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium" });
}

export function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export const itemQty = (it: ItemState) => it.sizes.reduce((a, [, q]) => a + (q > 0 ? q : 0), 0);

/* ------------------------- line price recalculation ------------------------- */

export interface LinePriceSuggestion {
  /** Suggested per-unit price, rounded to cents. */
  unit: number;
  /** Quantity the tier was read at (combined across the lines sharing the design). */
  qty: number;
  /** Curve axis the price came off. */
  decoration: QuoteDecoration;
  /** One-time fees that are configured but deliberately NOT in the unit price. */
  setupNote: string | null;
}

/** A colour count typed by hand or pre-filled by the designer ("~3", "Full colour"). */
function spotColours(raw: string): number {
  const n = parseInt(raw.replace(/^~/, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * What this line should cost per piece, off the product's customer curve:
 *
 *   unit = priceFromCurve(curve, { qty: combined quantity across every line on
 *          the order sharing this design, colours: the largest colour count
 *          across the line's prints, locations: number of prints, decoration })
 *        + the embroidery size adder for each embroidery print
 *
 * Screen setup and embroidery digitizing are ONE-TIME fees, so they never touch
 * the per-piece price; they come back as `setupNote` for the admin to add to the
 * order's setup fees by hand. Both default to 0 (amortized into the curve), so
 * the note normally does not appear at all.
 *
 * Returns null when the product has no curve, or the curve cannot price this
 * config, in which case the stored price is left exactly as it is.
 */
export function suggestLineUnitPrice(
  curve: ProductQuoteCurveJson | null,
  spots: DecorationSpot[],
  qty: number,
  settings: DecorationPricingSettings,
): LinePriceSuggestion | null {
  if (!curve || qty <= 0) return null;

  const embroiderySpots = spots.filter((s) => /embroider/i.test(s.type));
  const decoration: QuoteDecoration =
    embroiderySpots.length > 0 && curve.breaks.embroidery?.length
      ? "embroidery"
      : curve.breaks.screen?.length
        ? "screen"
        : defaultDecoration(curve);
  const colours = Math.max(1, ...spots.map((s) => spotColours(s.colours)));
  const locations = Math.max(1, spots.length);

  const result = priceFromCurve(curve, { qty, colours, locations, decoration }, settings);
  if (!result.available) return null;

  const sizeAdder = embroiderySpots.reduce(
    (sum, s) => sum + embroiderySizeSurcharge(parseFloat(s.widthIn) || 0, parseFloat(s.heightIn) || 0, settings),
    0,
  );

  const oneTime: string[] = [];
  if (decoration === "screen" && settings.screen.setupPerScreen > 0) {
    const screens = colours * locations;
    oneTime.push(
      `${formatCAD(settings.screen.setupPerScreen * screens)} of screen setup (${screens} screen${screens === 1 ? "" : "s"})`,
    );
  }
  if (decoration === "embroidery" && settings.embroidery.digitizationFee > 0) {
    oneTime.push(`${formatCAD(settings.embroidery.digitizationFee)} of digitizing`);
  }

  return {
    unit: Math.round((result.perUnit + sizeAdder) * 100) / 100,
    qty,
    decoration,
    setupNote: oneTime.length
      ? `${oneTime.join(" and ")} is not in this price. Add it under Setup fees if you charge it.`
      : null,
  };
}

/**
 * What does this order need from Julian right now? Drives the command header's
 * one big hero action. The component maps each kind to buttons/dialogs.
 */
export type NextActionKind =
  | "mark-received" // draft
  | "upload-proof" // submitted | in_review
  | "awaiting-approval" // proof_ready
  | "upload-new-proof" // changes_requested
  | "verify-etransfer" // customer reported an e-transfer; Julian checks the bank and confirms
  | "approved-invoice" // approved, unpaid, customer self-serves payment; link email is optional
  | "start-production" // approved (already invoiced/paid)
  | "mark-shipped" // in_production | quality_check, ship
  | "ready-for-pickup" // in_production | quality_check, pickup
  | "complete" // shipped | ready_for_pickup
  | "completed" // completed
  | "on-hold" // on_hold
  | "cancelled" // cancelled
  | "none";

export function nextAction(order: OrderRow): NextActionKind {
  switch (order.status as OrderStatus) {
    case "draft":
      return "mark-received";
    case "submitted":
    case "in_review":
      return "upload-proof";
    case "proof_ready":
      return "awaiting-approval";
    case "changes_requested":
      return "upload-new-proof";
    case "approved":
      if (order.etransfer_reported_at && !order.paid_at) return "verify-etransfer";
      return !order.invoice_sent_at && order.payment_status === "unpaid" ? "approved-invoice" : "start-production";
    case "in_production":
    case "quality_check":
      return order.fulfillment_method === "pickup" ? "ready-for-pickup" : "mark-shipped";
    case "shipped":
    case "ready_for_pickup":
      return "complete";
    case "completed":
      return "completed";
    case "on_hold":
      return "on-hold";
    case "cancelled":
      return "cancelled";
    default:
      return "none";
  }
}

/** Statuses where saving a tracking number auto-ships (mirrors setTrackingAction server-side). */
export const SHIP_ON_TRACKING = new Set<string>([
  "submitted", "in_review", "proof_ready", "changes_requested", "approved", "in_production", "quality_check",
]);

/** Shared "run a server action → toast → refresh" helper with its own pending state. */
export function useOrderAction() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  function run(
    fn: () => Promise<{ ok?: boolean; error?: string }>,
    okMsg: string,
    after?: () => void,
  ) {
    start(async () => {
      const res = await fn();
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: okMsg, variant: "success" });
        after?.();
        router.refresh();
      }
    });
  }

  return { pending, run };
}

/** Stage a proof file to the proofs bucket then link it (optionally to one line item). */
export function useProofUpload(orderId: string) {
  const router = useRouter();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  async function uploadProofs(files: File[], lineItemId?: string): Promise<{ ok?: boolean; error?: string; note?: string }> {
    if (files.length === 0) return { error: "No files selected" };
    setUploading(true);
    try {
      // Mint a signed upload URL per file (front / back / …) in one request.
      const res = await fetch("/api/design/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map((f, i) => ({ id: `p${i}`, bucket: "proofs", name: f.name, kind: "proof", size: f.size })),
        }),
      });
      if (!res.ok) throw new Error("Could not prepare upload");
      const { uploads } = (await res.json()) as { uploads: { id: string; bucket: string; path: string; token: string }[] };
      const supabase = createSupabaseBrowserClient();

      // Upload each file to its signed URL (parallel), then persist all paths together.
      const byId = new Map(uploads.map((u) => [u.id, u]));
      await Promise.all(
        files.map(async (f, i) => {
          const u = byId.get(`p${i}`);
          if (!u) throw new Error("Upload URL missing for a file");
          const { error: upErr } = await supabase.storage
            .from(u.bucket)
            .uploadToSignedUrl(u.path, u.token, f, { contentType: f.type || "image/png" });
          if (upErr) throw new Error(upErr.message);
        })
      );

      const paths = files.map((_, i) => byId.get(`p${i}`)!.path);
      const result = await uploadProofsAction(orderId, paths, lineItemId);
      if (result.error) throw new Error(result.error);
      // Uploading only files the proof; sending for approval is its own action.
      toast({
        title: files.length > 1 ? "Proofs saved to order" : "Proof saved to order",
        description: result.note,
        variant: "success",
      });
      router.refresh();
      return { ok: true, note: result.note };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast({ title: "Proof upload failed", description: message, variant: "error" });
      return { error: message || "Upload failed" };
    } finally {
      setUploading(false);
    }
  }

  return { uploading, uploadProofs };
}
