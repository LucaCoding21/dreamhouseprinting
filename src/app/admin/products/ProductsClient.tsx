"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { formatCAD } from "@/lib/money";
import { curveForProduct, shopPrice } from "@/lib/pricing/quote";
import { productPrimaryImage } from "@/lib/productImage";
import type { ProductRow, CategoryRow } from "@/lib/db/rows";
import { BulkProductActions, SelectBox } from "./BulkProductActions";
import { ImportDialog } from "./ImportDialog";
import { CategoriesPanel, AddCategoryDialog } from "./CategoriesPanel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";

export type ProductsTab = "products" | "categories";

/** Plain text status. Only Live and No pricing carry colour, so they stand out in a long list. */
function ProductStatus({ product, className }: { product: ProductRow; className: string }) {
  return (
    <div className={`flex whitespace-nowrap text-sm ${className}`}>
      {product.is_active ? (
        <span className="font-medium text-dream-success">Live</span>
      ) : (
        <span className="text-dream-muted">Hidden</span>
      )}
      {product.is_featured && <span className="text-dream-muted">Featured</span>}
      {!curveForProduct(product) && <span className="font-medium text-dream-warn">No pricing</span>}
    </div>
  );
}

export function ProductsClient({
  products,
  categories,
  initialTab,
  fromProductId,
}: {
  products: ProductRow[];
  categories: CategoryRow[];
  initialTab: ProductsTab;
  /** Set when the product editor's "Manage categories" link sent Julian here. */
  fromProductId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<ProductsTab>(initialTab);
  const [addingCategory, setAddingCategory] = useState(false);
  const fromProduct = fromProductId ? products.find((p) => p.id === fromProductId) : undefined;

  function switchTab(next: ProductsTab) {
    setTab(next);
    // Keep the tab in the URL so a refresh (or the editor's link) lands on it.
    const qs = next === "categories" ? "?tab=categories" : "";
    window.history.replaceState(null, "", `/admin/products${qs}`);
  }
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "-";

  // Search + filters, all client-side (the list is a few dozen rows).
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("any");
  const [brandFilter, setBrandFilter] = useState("any");
  const [statusFilter, setStatusFilter] = useState<"any" | "live" | "hidden" | "unpriced" | "featured">("any");
  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand).filter((b): b is string => !!b))).sort(),
    [products],
  );
  const filtersActive = catFilter !== "any" || brandFilter !== "any" || statusFilter !== "any";
  const q = query.trim().toLowerCase();
  const visible = products.filter((p) => {
    if (q && ![p.name, p.brand, p.ss_style_name, p.ss_part_number].some((v) => v?.toLowerCase().includes(q))) return false;
    if (catFilter !== "any" && p.category_id !== catFilter) return false;
    if (brandFilter !== "any" && p.brand !== brandFilter) return false;
    if (statusFilter === "live" && !p.is_active) return false;
    if (statusFilter === "hidden" && p.is_active) return false;
    if (statusFilter === "featured" && !p.is_featured) return false;
    if (statusFilter === "unpriced" && curveForProduct(p)) return false;
    return true;
  });

  // Bulk selection. Actions only ever apply to ticked rows still on screen, so
  // a filter change can't quietly delete something Julian can no longer see.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selected = visible.filter((p) => selectedIds.has(p.id));
  const allSelected = visible.length > 0 && selected.length === visible.length;

  function toggleOne(id: string, on: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(on: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of visible) {
        if (on) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }

  return (
    <div>
      <AdminHeader title="Products">
        {/* Add category on both tabs, so a missing category never means a trip
            to Categories. Import is a Products-tab action only. */}
        <Button variant="secondary" onClick={() => setAddingCategory(true)}>
          + Add category
        </Button>
        {tab === "products" && (
          <Button variant="primary" onClick={() => setImporting(true)}>
            + Import from S&amp;S
          </Button>
        )}
      </AdminHeader>

      <div className="px-4 py-6 sm:px-8">
        <Tabs value={tab} onValueChange={(v) => switchTab(v as ProductsTab)} className="mb-5">
          <TabsList>
            <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
            <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "categories" ? (
          <CategoriesPanel
            categories={categories}
            products={products}
            addOpen={addingCategory}
            onAddOpenChange={setAddingCategory}
            backTo={fromProduct ? { id: fromProduct.id, name: fromProduct.name } : null}
          />
        ) : products.length === 0 ? (
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
          <div className="mb-4 md:flex md:items-center md:gap-2">
          <div className="relative mb-4 max-w-full sm:max-w-sm md:order-last md:mb-0 md:ml-auto md:w-72">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dream-faint"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, brand or style number"
              aria-label="Search products"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar md:min-w-0 md:flex-wrap md:overflow-x-visible">
            <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Filter by category" className="w-auto min-w-36">
              <option value="any">Any category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {brands.length > 0 && (
              <Select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} aria-label="Filter by brand" className="w-auto min-w-36">
                <option value="any">Any brand</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            )}
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status" className="w-auto min-w-36">
              <option value="any">Any status</option>
              <option value="live">Live in shop</option>
              <option value="hidden">Hidden</option>
              <option value="featured">Featured</option>
              <option value="unpriced">No pricing</option>
            </Select>
            <span className="shrink-0 text-sm text-dream-muted">
              {visible.length} of {products.length}
            </span>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setCatFilter("any");
                  setBrandFilter("any");
                  setStatusFilter("any");
                }}
                className="shrink-0 px-2 text-sm font-medium text-dream-purple hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState title="No products match" description="Try a different search or clear the filters." />
          ) : (
          <>
          <BulkProductActions selected={selected} onClear={() => setSelectedIds(new Set())} />
          {/* Phones get a tappable card list, the six-column table is a blind
              side-scroll below md. */}
          <div
            className={`divide-y divide-dream-line overflow-hidden rounded-xl border border-dream-line bg-dream-surface md:hidden ${
              selected.length > 0 ? "mb-28" : ""
            }`}
          >
            <div className="flex items-center text-sm font-medium text-dream-ink">
              <SelectBox label="Select all products shown" checked={allSelected} onChange={toggleAllVisible} />
              Select all {visible.length}
            </div>
            {visible.map((p) => {
              const img = productPrimaryImage(p);
              return (
                <div key={p.id} className={`flex items-center ${selectedIds.has(p.id) ? "bg-dream-lavender-mist" : ""}`}>
                  <SelectBox
                    label={`Select ${p.name}`}
                    checked={selectedIds.has(p.id)}
                    onChange={(on) => toggleOne(p.id, on)}
                  />
                  <Link href={`/admin/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-dream-line bg-dream-bg">
                      {img && (
                        <Image src={img} alt="" width={44} height={44} className="h-full w-full object-contain" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-dream-ink">{p.name}</div>
                      <div className="truncate text-xs text-dream-muted">{catName(p.category_id)}</div>
                    </div>
                    <ProductStatus product={p} className="shrink-0 flex-col items-end gap-0.5 text-right" />
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="hidden rounded-xl border border-dream-line bg-dream-surface md:block">
            <Table>
              <THead>
                <TR>
                  <TH className="w-11 py-0 pl-1 pr-0">
                    <SelectBox label="Select all products shown" checked={allSelected} onChange={toggleAllVisible} />
                  </TH>
                  <TH>Product</TH>
                  <TH>Category</TH>
                  <TH>Colours</TH>
                  <TH>Starting at</TH>
                  <TH>Status</TH>
                  <TH> </TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((p) => {
                  const img = productPrimaryImage(p);
                  const colourCount = Array.isArray(p.colours) ? p.colours.length : 0;
                  return (
                    <TR
                      key={p.id}
                      className={`cursor-pointer ${selectedIds.has(p.id) ? "bg-dream-lavender-mist" : ""}`}
                      onClick={() => router.push(`/admin/products/${p.id}`)}
                    >
                      <TD className="py-0 pl-1 pr-0">
                        <SelectBox
                          label={`Select ${p.name}`}
                          checked={selectedIds.has(p.id)}
                          onChange={(on) => toggleOne(p.id, on)}
                        />
                      </TD>
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
                              {[p.brand, p.ss_part_number ? `#${p.ss_part_number}` : "manual"].filter(Boolean).join(" ")}
                            </div>
                          </div>
                        </div>
                      </TD>
                      <TD>{catName(p.category_id)}</TD>
                      <TD>{colourCount}</TD>
                      <TD>{formatCAD(shopPrice(p).amount)}</TD>
                      <TD>
                        <ProductStatus product={p} className="items-center gap-3" />
                      </TD>
                      <TD>
                        <span className="text-sm font-medium text-dream-purple hover:underline">Edit</span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
          </>
          )}
          </>
        )}
      </div>

      {tab === "products" && (
        <AddCategoryDialog
          open={addingCategory}
          onOpenChange={setAddingCategory}
          mains={categories.filter((c) => !c.parent_id).sort((a, b) => a.display_order - b.display_order)}
          items={categories}
          onAdded={(cat) => {
            toast({
              title: `Added ${cat.name}`,
              description: "Pick it as the category on any product to put it in the shop.",
              variant: "success",
            });
            router.refresh();
          }}
        />
      )}

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
