import React from "react";
import Link from "next/link";
import {
  getCategories,
  getMajorCategories,
  getActiveProducts,
  getCategoryBySlug,
} from "@/lib/db/catalog";
import type { CategoryRow } from "@/lib/db/rows";
import { ShopSidebar } from "@/components/storefront/ShopSidebar";
import { ProductCard } from "@/components/storefront/ProductCard";
import { SortSelect } from "@/components/storefront/SortSelect";
import { ShopSearch } from "@/components/storefront/ShopSearch";
import { EmptyState } from "@/components/ui";
import { startingAtPrice } from "@/lib/pricing/platform";
import { cn } from "@/lib/cn";

interface ShopSearchParams {
  category?: string;
  search?: string;
  sort?: string;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}) {
  const { category, search, sort } = await searchParams;
  const filtered = Boolean(category || search);

  const [categories, majors] = await Promise.all([
    getCategories(),
    getMajorCategories(),
  ]);

  return (
    <main className="mx-auto max-w-[88rem] px-4 pb-6 pt-9 sm:px-6 sm:pb-8 sm:pt-12">
      <header className="mb-11 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-dream-ink sm:text-4xl">
            Shop Custom Apparel in Vancouver
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-dream-ink-soft">
            Pick a blank, customize it in our designer, and get a free proof before we print.
          </p>
        </div>
        <ShopSearch />
      </header>

      <div className="mt-2 flex flex-col gap-8 lg:flex-row lg:gap-10">
        <aside className="lg:w-60 lg:shrink-0">
          <div className="lg:sticky lg:top-20">
            <ShopSidebar categories={categories} activeSlug={category} />
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {/* Category tiles — 4 majors + an "All Products" catch-all (§3.3.1). */}
          <CategoryTiles
            majors={majors}
            activeSlug={category}
            allActive={!category}
          />

          <div className="mt-8">
            {filtered ? (
              <FilteredView category={category} search={search} sort={sort} />
            ) : (
              <DefaultView sort={sort} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/* ----------------------------- Default view ----------------------------- */
/* One calm "all products" grid. Category filtering lives in the tiles +      */
/* sidebar, so the body stays a single browse surface (no redundant tabs).    */

async function DefaultView({ sort }: { sort?: string }) {
  const dbSort = sort === "name" ? "name" : sort === "newest" ? "newest" : "featured";
  const fetched = await getActiveProducts({ sort: dbSort, limit: 48 });
  const allProducts =
    sort === "price-asc"
      ? [...fetched].sort((a, b) => startingAtPrice(a) - startingAtPrice(b))
      : sort === "price-desc"
        ? [...fetched].sort((a, b) => startingAtPrice(b) - startingAtPrice(a))
        : fetched;
  const empty = allProducts.length === 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-xl font-bold text-dream-ink">All products</h2>
          <span className="text-sm text-dream-muted">
            {allProducts.length} {allProducts.length === 1 ? "product" : "products"}
          </span>
        </div>
        {allProducts.length > 0 && <SortSelect value={sort ?? "featured"} />}
      </div>
      {empty ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-dream-line bg-white"
          title="No products yet, check back soon"
          description="We're still loading the catalog. New blanks land here as they're added."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {allProducts.map((p) => (
            <ProductCard key={p.id} product={p} featured={p.is_featured} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Filtered view ----------------------------- */
/* A specific category and/or a search term — server-rendered grid, no tabs.  */

async function FilteredView({
  category,
  search,
  sort,
}: {
  category?: string;
  search?: string;
  sort?: string;
}) {
  const dbSort = sort === "name" ? "name" : sort === "newest" ? "newest" : "featured";
  const [cat, fetched] = await Promise.all([
    category ? getCategoryBySlug(category) : Promise.resolve(null),
    getActiveProducts({ categorySlug: category, search, sort: dbSort }),
  ]);

  // Price sorts run on the computed "from" price (not a stored column).
  const products =
    sort === "price-asc"
      ? [...fetched].sort((a, b) => startingAtPrice(a) - startingAtPrice(b))
      : sort === "price-desc"
        ? [...fetched].sort((a, b) => startingAtPrice(b) - startingAtPrice(a))
        : fetched;

  const heading = search
    ? `Results for “${search}”`
    : cat?.name ?? "Products";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-xl font-bold text-dream-ink">{heading}</h2>
          <span className="text-sm text-dream-muted">
            {products.length} {products.length === 1 ? "product" : "products"}
          </span>
        </div>
        {products.length > 0 && <SortSelect value={sort ?? "featured"} />}
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="rounded-xl border border-dashed border-dream-line bg-dream-surface"
          title={search ? "No matches" : "Nothing here yet"}
          description={
            search
              ? "Try a different search, or browse all products."
              : "No products in this category right now — check back soon."
          }
          action={
            <Link
              href="/shop"
              className="inline-flex h-10 items-center rounded-full bg-dream-purple px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Browse all products
            </Link>
          }
        />
      )}
    </div>
  );
}

/* ----------------------------- Category tiles ---------------------------- */

function CategoryTiles({
  majors,
  activeSlug,
  allActive,
}: {
  majors: CategoryRow[];
  activeSlug?: string;
  allActive: boolean;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-5">
      <Tile href="/shop" label="All Products" slug="all" active={allActive} />
      {majors.map((cat) => (
        <Tile
          key={cat.id}
          href={`/shop?category=${cat.slug}`}
          label={cat.name}
          slug={cat.slug}
          active={activeSlug === cat.slug}
        />
      ))}
    </div>
  );
}

function Tile({
  href,
  label,
  slug,
  active,
}: {
  href: string;
  label: string;
  slug: string;
  active: boolean;
}) {
  const icon = CATEGORY_ICONS[slug] ?? CATEGORY_ICONS.all;
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2.5 focus-visible:outline-none"
    >
      <span
        className={cn(
          // Blobby squircle disc — the non-rectangular shape, brand lavender.
          "flex aspect-square w-full max-w-[7.5rem] items-center justify-center rounded-[42%_58%_55%_45%/55%_45%_55%_45%] border-2 transition-all duration-200 group-hover:-translate-y-1",
          "group-focus-visible:ring-2 group-focus-visible:ring-dream-purple/40",
          active
            ? "border-dream-purple bg-dream-purple/10 ring-1 ring-dream-purple/30"
            : "border-transparent bg-dream-lavender-soft group-hover:shadow-[0_8px_0_0_rgba(27,20,88,0.9)]",
        )}
      >
        <span
          className={cn(
            "h-[46%] w-[46%] transition-colors [&_svg]:transition-[fill]",
            active
              ? "text-dream-purple [&_svg]:fill-current"
              : "text-dream-purple/70 group-hover:text-dream-purple",
          )}
        >
          {icon}
        </span>
      </span>
      <span
        className={cn(
          "text-center font-display text-[13px] font-semibold leading-tight sm:text-sm",
          active ? "text-dream-purple" : "text-dream-ink",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

/* Inline apparel icons, keyed by category slug. Stroked, inherit currentColor. */
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  shirts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M8.4 3.5 5.6 5 2.8 7.4 5 10.2 7 9.1V20.5h10V9.1l2 1.1 2.2-2.8L18.4 5l-2.8-1.5c-.4 1.6-1.7 2.6-3.6 2.6s-3.2-1-3.6-2.6Z" />
    </svg>
  ),
  hoodies: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M8 4 5.4 5.4 2.7 8l2.2 2.8L7 9.6V20.5h10V9.6l2.1 1.2L21.3 8l-2.7-2.6L16 4" />
      <path d="M8 4c.6 2.1 2 3.1 4 3.1S15.4 6.1 16 4" />
      <path d="M11 7.2v2.6M13 7.2v2.6" />
      <path d="M9.4 13.2h5.2l-.5 3.8H9.9Z" />
    </svg>
  ),
  "hats-toques": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M4.5 14c0-4.7 3.4-8 7.5-8s7.5 3.3 7.5 7.6" />
      <path d="M4 14h12.2c3.1 0 5.6.6 5.6 1.7s-1.4 1.6-3.3 1.6H4Z" />
      <path d="M12 6V4.2" />
    </svg>
  ),
  totes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M6.2 8h11.6l-1 12.5H7.2Z" />
      <path d="M9 8V6.4a3 3 0 0 1 6 0V8" />
    </svg>
  ),
  all: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </svg>
  ),
};
