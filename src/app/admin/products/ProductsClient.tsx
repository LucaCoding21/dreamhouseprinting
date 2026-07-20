"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/use-toast";
import { formatCAD } from "@/lib/money";
import { curveForProduct, shopPrice } from "@/lib/pricing/quote";
import { productPrimaryImage } from "@/lib/productImage";
import type { ProductRow, CategoryRow } from "@/lib/db/rows";
import { ssSearchAction, importStyleAction } from "./actions";

interface SearchResult {
  styleID: number;
  brand: string;
  styleName: string;
  title: string;
  image: string | null;
}

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

      <div className="px-8 py-6">
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
          <div className="rounded-xl border border-dream-line bg-dream-surface">
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

function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (productId: string) => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [importingId, setImportingId] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  function search() {
    const q = query.trim();
    if (q.length < 2) {
      setHint("Type at least 2 characters, a style number (like 3001) or a brand name.");
      return;
    }
    setHint(null);
    startSearch(async () => {
      const res = await ssSearchAction(q);
      if (res.error) {
        toast({ title: "Search failed", description: res.error, variant: "error" });
        return;
      }
      setResults(res.results ?? []);
      setSearched(true);
    });
  }

  async function doImport(styleID: number) {
    setImportingId(styleID);
    const res = await importStyleAction(styleID);
    setImportingId(null);
    if (res.error || !res.productId) {
      toast({ title: "Import failed", description: res.error ?? "Unknown error", variant: "error" });
      return;
    }
    onImported(res.productId);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl" backdropClassName="bg-dream-overlay/50 backdrop-blur-sm">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>Import from S&amp;S Activewear</DialogTitle>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <Input
            autoFocus
            placeholder="Search by style # or brand (e.g. 3001, Gildan, hoodie)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" variant="primary" loading={searching}>
            Search
          </Button>
        </form>

        <p className="mt-2 text-xs text-dream-muted">
          Products import as hidden drafts. You&apos;ll set the category, pricing, and print area next, then turn
          them on.
        </p>
        {hint && <p className="mt-1.5 text-xs font-medium text-dream-warn">{hint}</p>}

        <div className="mt-4 max-h-[55vh] overflow-y-auto">
          {searching ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 text-dream-purple" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-dream-muted">
              {searched
                ? "No styles matched. Try a style number (like 3001) or a brand name. Note: we search the S&S Canada catalog, US-only styles won't appear."
                : "Search the catalog to import a blank garment."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {results.map((r) => (
                <div
                  key={r.styleID}
                  className="flex flex-col rounded-xl border border-dream-line p-3"
                >
                  <div className="mb-2 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-dream-bg">
                    {r.image && (
                      <Image src={r.image} alt={r.title} width={120} height={112} className="h-full object-contain" />
                    )}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-dream-muted">{r.brand}</div>
                  <div className="text-sm font-medium text-dream-ink">
                    {r.styleName}, {r.title}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    loading={importingId === r.styleID}
                    onClick={() => doImport(r.styleID)}
                  >
                    Import
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
