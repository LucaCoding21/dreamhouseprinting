"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Delete one of the signed-in customer's draft designs. Refuses unless the
 * design is theirs, is still a draft, and is not attached to any order (orders
 * reference designs through line_items.design_id). Ownership is proven before
 * we reach for the service client, so the service read/write is safe.
 */
export async function deleteDesignAction(
  designId: string
): Promise<{ ok?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Please sign in and try again." };

  const service = requireSupabaseServiceClient();

  const { data: design, error: fetchErr } = await service
    .from("designs")
    .select("id, customer_id, status")
    .eq("id", designId)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message };
  if (!design) return { error: "That design no longer exists." };
  if (design.customer_id !== user.id) return { error: "That design isn't on your account." };
  if (design.status !== "draft") {
    return { error: "Only draft designs can be deleted. This one is already submitted." };
  }

  // Guard: never delete a design an order points at.
  const { count, error: liErr } = await service
    .from("line_items")
    .select("id", { count: "exact", head: true })
    .eq("design_id", designId);
  if (liErr) return { error: liErr.message };
  if ((count ?? 0) > 0) {
    return { error: "This design is attached to an order, so it can't be deleted." };
  }

  const { error: delErr } = await service.from("designs").delete().eq("id", designId);
  if (delErr) return { error: delErr.message };

  revalidatePath("/account/designs");
  return { ok: true };
}
