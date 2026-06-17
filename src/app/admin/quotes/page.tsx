import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { ProfileRow } from "@/lib/db/rows";
import { QuotesClient, type QuoteListItem } from "./QuotesClient";

export const metadata = { title: "Quotes — Admin" };

export default async function AdminQuotesPage() {
  await requirePermission("quotes.manage");
  const supabase = requireSupabaseServiceClient();

  const { data: quotes } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });

  const rowsRaw = quotes ?? [];

  // Resolve customer names and the linked designs' first mockup for thumbnails.
  const customerIds = [...new Set(rowsRaw.map((q) => q.customer_id).filter(Boolean))] as string[];
  const designIds = [...new Set(rowsRaw.flatMap((q) => q.design_ids ?? []))] as string[];

  const [{ data: profiles }, designMockups] = await Promise.all([
    customerIds.length
      ? supabase.from("profiles").select("id, name, email").in("id", customerIds)
      : Promise.resolve({ data: [] as Pick<ProfileRow, "id" | "name" | "email">[] }),
    (async () => {
      const map = new Map<string, string | null>();
      if (designIds.length) {
        const { data: designs } = await supabase
          .from("designs")
          .select("id, mockup_images")
          .in("id", designIds);
        for (const d of designs ?? []) {
          const m = ((d.mockup_images ?? []) as unknown as { url: string | null }[]).find((x) => x.url)?.url ?? null;
          map.set(d.id, m);
        }
      }
      return map;
    })(),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rows: QuoteListItem[] = rowsRaw.map((q) => {
    const profile = q.customer_id ? profileById.get(q.customer_id) : undefined;
    const contact = (q.contact ?? {}) as unknown as { name?: string; email?: string };
    const pricing = (q.pricing ?? {}) as unknown as { total?: number };
    const thumbnail =
      (q.design_ids ?? []).map((id) => designMockups.get(id)).find(Boolean) ?? null;

    return {
      id: q.id,
      quoteNumber: q.quote_number,
      status: q.status,
      createdAt: q.created_at,
      customerName: profile?.name ?? contact.name ?? null,
      customerEmail: profile?.email ?? contact.email ?? null,
      message: q.message,
      total: pricing.total ?? 0,
      designCount: (q.design_ids ?? []).length,
      thumbnail,
      convertedOrderId: q.converted_order_id,
    };
  });

  return <QuotesClient rows={rows} />;
}
