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
} from "@/lib/db/rows";

export interface Detail {
  order: OrderRow;
  customer: Pick<ProfileRow, "id" | "name" | "email" | "phone"> | null;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  proofs: ProofRow[];
  activity: OrderActivityRow[];
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

  async function uploadProof(file: File, lineItemId?: string) {
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
    } catch (err) {
      toast({ title: "Proof upload failed", description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setUploading(false);
    }
  }

  return { uploading, uploadProof };
}
