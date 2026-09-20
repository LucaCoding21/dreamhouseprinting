"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { formatCAD } from "@/lib/money";
import { curveForProduct, shopPrice } from "@/lib/pricing/quote";
import { productPrimaryImage } from "@/lib/productImage";
import type { ProductRow, CategoryRow } from "@/lib/db/rows";
import { ImportDialog } from "./ImportDialog";

export function ProductsClient({
  products,
  categories,
}: {
  products: ProductRow[];
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "-";

  return (
    <div>
      <AdminHeader title="Products">
        <Button variant="primary" onClick={() => setImporting(true)}>
          + Import from S&amp;S
        </Button>
      </AdminHeader>

      <div className="px-4 py-6 sm:px-8">
        {products.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Import a blank from the S&S Activewear catalog to get started."
            action={
              <Button variant="primary" onClick={() => setImporting(true)}>
                Import from S&amp;S
              </Button>
            }
          />
        ) : (
          <>
          {/* Phones get a tappable card list, the six-column table is a blind
              side-scroll below md. */}
          <div className="divide-y divide-dream-line overflow-hidden rounded-xl border border-dream-line bg-dream-surface md:hidden">
            {products.map((p) => {
              const img = productPrimaryImage(p);
              return (
                <Link
                  key={p.id}
                  href={`/admin/products/${p.id}`}
                  className="flex items-center gap-3 p-3"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-dream-line bg-dream-bg">
                    {img && (
                      <Image src={img} alt="" width={44} height={44} className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-dream-ink">{p.name}</div>
                    <div className="truncate text-xs text-dream-muted">{catName(p.category_id)}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Badge variant={p.is_active ? "success" : "warn"}>
                      {p.is_active ? "Live" : "Hidden"}
                    </Badge>
                    {p.is_featured && <Badge variant="purple">Featured</Badge>}
                    {!curveForProduct(p) && <Badge variant="warn">No pricing</Badge>}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="hidden rounded-xl border border-dream-line bg-dream-surface md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Category</TH>
                  <TH>Colours</TH>
                  <TH>Starting at</TH>
                  <TH>Status</TH>
                  <TH> </TH>
                </TR>
              </THead>
              <TBody>
                {products.map((p) => {
                  const img = productPrimaryImage(p);
                  const colourCount = Array.isArray(p.colours) ? p.colours.length : 0;
                  return (
                    <TR
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/products/${p.id}`)}
                    >
                      <TD>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-dream-line bg-dream-bg">
                            {img && (
                              <Image src={img} alt="" width={48} height={48} className="h-full w-full object-contain" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-dream-ink">{p.name}</div>
                            <div className="text-xs text-dream-muted">
                              {p.brand} · {p.ss_part_number ? `#${p.ss_part_number}` : "manual"}
                            </div>
                          </div>
                        </div>
                      </TD>
                      <TD>{catName(p.category_id)}</TD>
                      <TD>{colourCount}</TD>
                      <TD>{formatCAD(shopPrice(p).amount)}</TD>
                      <TD>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={p.is_active ? "success" : "warn"}>
                            {p.is_active ? "Live" : "Hidden"}
                          </Badge>
                          {p.is_featured && <Badge variant="purple">Featured</Badge>}
                          {!curveForProduct(p) && <Badge variant="warn">No pricing</Badge>}
                        </div>
                      </TD>
                      <TD>
                        <span className="text-sm font-medium text-dream-purple">Edit</span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
          </>
        )}
      </div>

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onImported={(productId) => {
          toast({
            title: "Imported as a draft",
            description: "Set the category, pricing, and print area, then switch it on to go live.",
            variant: "success",
          });
          router.push(`/admin/products/${productId}`);
        }}
      />
    </div>
  );
}
