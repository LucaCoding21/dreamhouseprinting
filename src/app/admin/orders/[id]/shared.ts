"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { uploadProofAction } from "../actions";
import type { DecorationSpot } from "../actions";
import type {
  OrderRow,
  LineItemRow,
  DesignRow,
  ProofRow,
  OrderActivityRow,
  ProfileRow,
  OrderStatus,
} from "@/lib/db/rows";

export interface OrderProduct {
  id: string;
  name: string;
  brand: string | null;
  ss_style_name: string | null;
  ss_style_id: string | null;
}

export interface Detail {
  order: OrderRow;
  customer: Pick<ProfileRow, "id" | "name" | "email" | "phone"> | null;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  products: OrderProduct[];
  proofs: ProofRow[];
  activity: OrderActivityRow[];
}

/** Direct S&S Canada product page for a garment, e.g.
 *  https://en-ca.ssactivewear.com/p/comfort_colors/1717 . The brand slug is the
 *  lowercased brand with runs of non-alphanumerics collapsed to underscores; the
 *  en-ca host lands straight on the product instead of the .com country picker. */
export function ssSourceUrl(brand: string | null, styleName: string | null): string | null {
  if (!styleName || !brand) return null;
  const brandSlug = brand.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!brandSlug) return null;
  return `https://en-ca.ssactivewear.com/p/${brandSlug}/${encodeURIComponent(styleName.trim())}`;
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
}

export const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
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

/**
 * What does this order need from Julian right now? Drives the command header's
 * one big hero action. The component maps each kind to buttons/dialogs.
 */
export type NextActionKind =
  | "mark-received" // draft
  | "upload-proof" // submitted | in_review
  | "awaiting-approval" // proof_ready
  | "upload-new-proof" // changes_requested
  | "approved-invoice" // approved, not yet invoiced/paid
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

  async function uploadProof(file: File, lineItemId?: string): Promise<{ ok?: boolean; error?: string }> {
    setUploading(true);
    try {
      const res = await fetch("/api/design/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: [{ id: "p", bucket: "proofs", name: file.name, kind: "proof", size: file.size }] }),
      });
      if (!res.ok) throw new Error("Could not prepare upload");
      const { uploads } = (await res.json()) as { uploads: { id: string; bucket: string; path: string; token: string }[] };
      const u = uploads[0];
      const supabase = createSupabaseBrowserClient();
      const { error: upErr } = await supabase.storage
        .from(u.bucket)
        .uploadToSignedUrl(u.path, u.token, file, { contentType: file.type || "image/png" });
      if (upErr) throw new Error(upErr.message);
      const result = await uploadProofAction(orderId, u.path, lineItemId);
      if (result.error) throw new Error(result.error);
      toast({ title: "Proof sent to customer", variant: "success" });
      router.refresh();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast({ title: "Proof upload failed", description: message, variant: "error" });
      return { error: message || "Upload failed" };
    } finally {
      setUploading(false);
    }
  }

  return { uploading, uploadProof };
}
