import { getProfile, hasPermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import type { OrderRow, ProfileRow } from "@/lib/db/rows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PricingShape {
  total?: number;
}

/** Quote a CSV field per RFC 4180 (wrap and double quotes when needed). */
function csvField(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  // Verify staff + reports.view via the cookie-bound server client.
  const profile = await getProfile();
  if (!hasPermission(profile, "reports.view")) {
    return new Response("Forbidden", { status: 403 });
  }

  const supabase = requireSupabaseServiceClient();
  const { data: ordersData } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  const orders = (ordersData ?? []) as OrderRow[];

  const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))] as string[];
  const emailById = new Map<string, string | null>();
  if (customerIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", customerIds);
    for (const p of (profiles ?? []) as Pick<ProfileRow, "id" | "email">[]) {
      emailById.set(p.id, p.email);
    }
  }

  const header = [
    "order_number",
    "created_at",
    "status",
    "payment_status",
    "total",
    "customer_email",
  ];
  const lines = [header.join(",")];

  for (const o of orders) {
    const pricing = (o.pricing ?? {}) as unknown as PricingShape;
    const email = o.customer_id ? emailById.get(o.customer_id) ?? "" : "";
    lines.push(
      [
        csvField(o.order_number),
        csvField(o.created_at),
        csvField(o.status),
        csvField(o.payment_status),
        csvField((pricing.total ?? 0).toFixed(2)),
        csvField(email),
      ].join(",")
    );
  }

  const csv = lines.join("\r\n") + "\r\n";
  const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
