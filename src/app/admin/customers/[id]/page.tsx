import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCAD } from "@/lib/money";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/rows";

export const metadata = { title: "Customer | Admin" };

interface SavedArtwork {
  name: string;
  url: string | null;
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("customers.view");
  const { id } = await params;
  const supabase = requireSupabaseServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, phone, organization_id, saved_artwork")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const [{ data: orders }, { data: org }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, status, pricing, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    profile.organization_id
      ? supabase.from("organizations").select("name").eq("id", profile.organization_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
  ]);

  const orderRows = (orders ?? []).map((o) => {
    const pricing = (o.pricing ?? {}) as unknown as { total?: number };
    return {
      id: o.id,
      orderNumber: o.order_number,
      status: o.status as OrderStatus,
      total: pricing.total ?? 0,
      createdAt: o.created_at,
    };
  });

  const savedArtwork = (profile.saved_artwork ?? []) as unknown as SavedArtwork[];
  const totalSpent = orderRows.reduce((a, o) => a + o.total, 0);

  return (
    <div>
      <AdminHeader title={profile.name ?? profile.email ?? "Customer"}>
        <Link
          href="/admin/customers"
          className="text-sm font-medium text-dream-muted hover:text-dream-ink"
        >
          ← All customers
        </Link>
      </AdminHeader>

      <div className="space-y-6 px-8 py-6">
        {/* Profile header */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 py-5">
            <Avatar name={profile.name ?? profile.email ?? undefined} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-bold text-dream-ink">
                {profile.name ?? "-"}
              </div>
              <div className="text-sm text-dream-muted">{profile.email ?? "-"}</div>
              <div className="text-sm text-dream-muted">{profile.phone ?? "-"}</div>
              {org?.name && (
                <div className="mt-1">
                  <Badge variant="neutral">{org.name}</Badge>
                </div>
              )}
            </div>
            <div className="flex gap-6">
              <div>
                <div className="text-xs uppercase tracking-wide text-dream-muted">Orders</div>
                <div className="font-display text-2xl font-bold text-dream-ink">
                  {orderRows.length}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-dream-muted">Total spent</div>
                <div className="font-display text-2xl font-bold text-dream-ink">
                  {formatCAD(totalSpent)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order history */}
        <Card>
          <CardHeader>
            <CardTitle>Order history</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {orderRows.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState
                  title="No orders yet"
                  description="This customer hasn't placed any orders."
                />
              </div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    <TH>Date</TH>
                    <TH>Status</TH>
                    <TH>Total</TH>
                  </TR>
                </THead>
                <TBody>
                  {orderRows.map((o) => {
                    const meta = STATUS_META[o.status];
                    return (
                      <TR key={o.id}>
                        <TD>
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="font-medium text-dream-purple hover:underline"
                          >
                            {o.orderNumber ?? "-"}
                          </Link>
                        </TD>
                        <TD className="text-dream-muted">
                          {new Date(o.createdAt).toLocaleDateString("en-CA")}
                        </TD>
                        <TD>
                          <Badge variant={meta?.badge ?? "neutral"}>{meta?.label ?? o.status}</Badge>
                        </TD>
                        <TD className="font-medium text-dream-ink">{formatCAD(o.total)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Saved artwork */}
        <Card>
          <CardHeader>
            <CardTitle>Saved artwork</CardTitle>
          </CardHeader>
          <CardContent>
            {savedArtwork.length === 0 ? (
              <p className="text-sm text-dream-muted">No saved artwork on file.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {savedArtwork.map((a, i) => (
                  <a
                    key={i}
                    href={a.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="group block overflow-hidden rounded-xl border border-dream-line bg-dream-surface"
                  >
                    <div className="flex aspect-square items-center justify-center bg-dream-bg">
                      {a.url ? (
                        <Image
                          src={a.url}
                          alt={a.name}
                          width={240}
                          height={240}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-dream-muted">No preview</span>
                      )}
                    </div>
                    <div className="truncate px-3 py-2 text-sm text-dream-ink group-hover:text-dream-purple">
                      {a.name}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
