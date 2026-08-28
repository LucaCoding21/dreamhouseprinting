"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCAD } from "@/lib/money";

interface Row {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  org: string | null;
  orderCount: number;
  totalSpent: number;
}

export function CustomersClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.email, r.phone, r.org].some((v) => v?.toLowerCase().includes(q))
    );
  }, [rows, query]);

  return (
    <div>
      <AdminHeader title="Customers" />
      <div className="px-4 py-6 sm:px-8">
        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          {[
            { label: "Customers", value: `${rows.length}` },
            { label: "Total orders", value: `${rows.reduce((a, r) => a + r.orderCount, 0)}` },
            { label: "Lifetime spend", value: formatCAD(rows.reduce((a, r) => a + r.totalSpent, 0)) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-dream-line bg-dream-surface p-4">
              {/* A full CAD lifetime figure overflows a half-width tile at 375px. */}
              <div className="truncate font-display text-2xl font-bold text-dream-ink sm:text-3xl">{s.value}</div>
              <div className="text-sm text-dream-muted">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 max-w-sm">
          <Input
            placeholder="Search by name, email, phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={query ? "No matching customers" : "No customers yet"}
            description={
              query
                ? "Try a different search term."
                : "Customers appear here once they create an account or place an order."
            }
          />
        ) : (
          <>
          {/* Phones get a tappable card list instead of the five-column table. */}
          <div className="divide-y divide-dream-line overflow-hidden rounded-xl border border-dream-line bg-dream-surface md:hidden">
            {visible.map((r) => (
              <Link
                key={r.id}
                href={`/admin/customers/${r.id}`}
                className="flex items-center gap-3 p-3"
              >
                <Avatar name={r.name ?? r.email ?? undefined} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-dream-ink">{r.name ?? "-"}</div>
                  <div className="truncate text-xs text-dream-muted">{r.email ?? "-"}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-medium text-dream-ink">
                    {r.orderCount} {r.orderCount === 1 ? "order" : "orders"}
                  </div>
                  <div className="text-xs text-dream-muted">{formatCAD(r.totalSpent)}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="hidden rounded-xl border border-dream-line bg-dream-surface md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH>Phone</TH>
                  <TH>Organization</TH>
                  <TH>Orders</TH>
                  <TH>Total spent</TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((r) => (
                  <TR
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/customers/${r.id}`)}
                  >
                    <TD>
                      {/* Capped so a long email cannot widen the whole table. */}
                      <div className="flex max-w-[18rem] items-center gap-3">
                        <Avatar name={r.name ?? r.email ?? undefined} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-dream-ink">{r.name ?? "-"}</div>
                          <div className="truncate text-xs text-dream-muted">{r.email ?? "-"}</div>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-dream-muted">{r.phone ?? "-"}</TD>
                    <TD className="text-dream-muted">{r.org ?? "-"}</TD>
                    <TD className="font-medium text-dream-ink">{r.orderCount}</TD>
                    <TD className="font-medium text-dream-ink">{formatCAD(r.totalSpent)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
