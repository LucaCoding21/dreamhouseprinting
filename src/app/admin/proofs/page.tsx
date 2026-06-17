import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { OrderRow, LineItemRow, DesignRow, ProofRow, ProfileRow } from "@/lib/db/rows";
import { ProofsClient, type ProofQueueRow } from "./ProofsClient";

export const metadata = { title: "Proofs & Artwork — Admin" };

/** Statuses that surface in the proofing queue (PRD §7.4). */
const QUEUE_STATUSES = ["submitted", "in_review", "proof_ready", "changes_requested"];

type MockupImage = { view?: string; url: string | null };
type SourceArtwork = { name: string; url: string | null };

export default async function AdminProofsPage() {
  await requirePermission("proofs.manage");
  const supabase = requireSupabaseServiceClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .in("status", QUEUE_STATUSES)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const rows = await buildRows((orders ?? []) as OrderRow[], supabase);
  return <ProofsClient rows={rows} />;
}

async function buildRows(
  orders: OrderRow[],
  supabase: ReturnType<typeof requireSupabaseServiceClient>,
): Promise<ProofQueueRow[]> {
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))] as string[];

  const [{ data: lineItems }, { data: proofs }, { data: profiles }] = await Promise.all([
    supabase.from("line_items").select("*").in("order_id", orderIds),
    supabase
      .from("proofs")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
    customerIds.length
      ? supabase.from("profiles").select("id, name, email").in("id", customerIds)
      : Promise.resolve({ data: [] as Pick<ProfileRow, "id" | "name" | "email">[] }),
  ]);

  // Group line items by order, collect the design ids we need to resolve.
  const liByOrder = new Map<string, LineItemRow[]>();
  for (const li of (lineItems ?? []) as LineItemRow[]) {
    const arr = liByOrder.get(li.order_id) ?? [];
    arr.push(li);
    liByOrder.set(li.order_id, arr);
  }
  const designIds = [...new Set((lineItems ?? []).map((l) => l.design_id).filter(Boolean))] as string[];

  const designsById = new Map<string, DesignRow>();
  if (designIds.length) {
    const { data: designs } = await supabase
      .from("designs")
      .select("id, mockup_images, source_artwork_files")
      .in("id", designIds);
    for (const d of (designs ?? []) as Pick<DesignRow, "id" | "mockup_images" | "source_artwork_files">[]) {
      designsById.set(d.id, d as DesignRow);
    }
  }

  // Latest proof per order (proofs already sorted newest-first).
  const latestProofByOrder = new Map<string, ProofRow>();
  for (const p of (proofs ?? []) as ProofRow[]) {
    if (!latestProofByOrder.has(p.order_id)) latestProofByOrder.set(p.order_id, p);
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return orders.map((order) => {
    const items = liByOrder.get(order.id) ?? [];
    const designs = items
      .map((li) => (li.design_id ? designsById.get(li.design_id) : undefined))
      .filter(Boolean) as DesignRow[];

    const mockups: string[] = [];
    const sourceArt: { name: string; url: string }[] = [];
    for (const d of designs) {
      for (const m of (d.mockup_images ?? []) as unknown as MockupImage[]) {
        if (m.url) mockups.push(m.url);
      }
      for (const a of (d.source_artwork_files ?? []) as unknown as SourceArtwork[]) {
        if (a.url) sourceArt.push({ name: a.name, url: a.url });
      }
    }

    const profile = order.customer_id ? profileById.get(order.customer_id) : undefined;
    const latestProof = latestProofByOrder.get(order.id);

    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      dueDate: order.due_date,
      createdAt: order.created_at,
      customerName: profile?.name ?? null,
      customerEmail: profile?.email ?? null,
      mockups: mockups.slice(0, 4),
      sourceArt: sourceArt.slice(0, 6),
      changeRequest:
        latestProof?.status === "changes_requested" ? latestProof.change_request_comment ?? null : null,
    } satisfies ProofQueueRow;
  });
}
