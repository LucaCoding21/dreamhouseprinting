"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
      <div className="px-8 py-6">
        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          {[
            { label: "Customers", value: `${rows.length}` },
            { label: "Total orders", value: `${rows.reduce((a, r) => a + r.orderCount, 0)}` },
            { label: "Lifetime spend", value: formatCAD(rows.reduce((a, r) => a + r.totalSpent, 0)) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-dream-line bg-dream-surface p-4">
              <div className="font-display text-3xl font-bold text-dream-ink">{s.value}</div>
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
          <div className="rounded-xl border border-dream-line bg-dream-surface">
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
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name ?? r.email ?? undefined} size="sm" />
                        <div>
                          <div className="font-medium text-dream-ink">{r.name ?? "—"}</div>
                          <div className="text-xs text-dream-muted">{r.email ?? "—"}</div>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-dream-muted">{r.phone ?? "—"}</TD>
                    <TD className="text-dream-muted">{r.org ?? "—"}</TD>
                    <TD className="font-medium text-dream-ink">{r.orderCount}</TD>
                    <TD className="font-medium text-dream-ink">{formatCAD(r.totalSpent)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
