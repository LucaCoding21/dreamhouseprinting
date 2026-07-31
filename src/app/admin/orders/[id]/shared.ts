"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { defaultDecoration, priceFromCurve, priceFromCurveForPrints } from "@/lib/pricing/quote";
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
}

/** A colour count typed by hand or pre-filled by the designer ("~3", "Full colour"). */
function spotColours(raw: string): number {
  const n = parseInt(raw.replace(/^~/, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * What this line should cost per piece, off the product's customer curve.
 *
 * Priced PER PRINT and summed, not as one decoration for the whole line:
 *
 *   unit = base tier price for the first print's decoration, at the combined
 *          quantity across every line on the order sharing this design
 *        + for each print after the first, that print's OWN extra-location rate
 *        + a colour surcharge for each SCREEN print, on its own colour count
 *        + the embroidery size adder for each embroidery print
 *
 * The line used to be priced as a single decoration: if any print was
 * embroidery the whole line went on the embroidery curve, so a screen print
 * added to an embroidered line was charged at embroidery rates and its ink
 * colours came out free (colour surcharge is screen-only). Summing per print
 * also matches how the home-page quick quote has priced multi-print jobs since
 * 2026-07-27, and how Julian described quoting: each print adds its own setup
 * and its own per-piece cost.
 *
 * Single-print lines are unaffected. Multi-print SCREEN lines go up, because
 * colours are now charged per print instead of once at the highest count.
 *
 * There is no setup line to add on top: the price list already collects it in
 * the low quantity tiers (see lib/pricing/decorationPricing).
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

  /** The decoration a print is priced on, narrowed to what the curve offers. */
  const decorationFor = (spot: DecorationSpot): QuoteDecoration => {
    const wanted: QuoteDecoration = /embroider/i.test(spot.type) ? "embroidery" : "screen";
    if (curve.breaks[wanted]?.length) return wanted;
    const other: QuoteDecoration = wanted === "embroidery" ? "screen" : "embroidery";
    return curve.breaks[other]?.length ? other : defaultDecoration(curve);
  };

  // A line with no prints yet still has a garment price to show.
  if (spots.length === 0) {
    const decoration = defaultDecoration(curve);
    const bare = priceFromCurve(curve, { qty, colours: 1, locations: 1, decoration }, settings);
    return bare.available
      ? { unit: Math.round(bare.perUnit * 100) / 100, qty, decoration }
      : null;
  }

  const decorations = spots.map(decorationFor);
  const primary = decorations[0];

  // Shared with the designer, cart and order placement so the three can't drift.
  const priced = priceFromCurveForPrints(
    curve,
    {
      qty,
      decoration: primary,
      prints: spots.map((sp, i) => ({ colours: spotColours(sp.colours), decoration: decorations[i] })),
    },
    settings,
  );
  if (!priced.available) return null;

  let unit = priced.perUnit;

  // Embroidery is also charged by stitch area, per embroidered print. Only the
  // admin sheet carries real measurements, so this lives here, not in the
  // shared pricer.
  for (let i = 0; i < spots.length; i++) {
    if (decorations[i] !== "embroidery") continue;
    unit += embroiderySizeSurcharge(
      parseFloat(spots[i].widthIn) || 0,
      parseFloat(spots[i].heightIn) || 0,
      settings,
    );
  }

  return { unit: Math.round(unit * 100) / 100, qty, decoration: primary };
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
