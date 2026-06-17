import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  getCategories,
  getMajorCategories,
  getFeaturedByCategory,
  getActiveProducts,
  getCategoryBySlug,
} from "@/lib/db/catalog";
import type { CategoryRow, ProductRow } from "@/lib/db/rows";
import { productPrimaryImage } from "@/lib/productImage";
import { ShopSidebar } from "@/components/storefront/ShopSidebar";
import { ProductCard } from "@/components/storefront/ProductCard";
import { CategoryTabs, type CategoryTab } from "@/components/storefront/CategoryTabs";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";

interface ShopSearchParams {
  category?: string;
  search?: string;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}) {
  const { category, search } = await searchParams;
  const filtered = Boolean(category || search);

  const [categories, majors] = await Promise.all([
    getCategories(),
    getMajorCategories(),
  ]);

  // Tile images: borrow a representative product image per major (best-effort).
  const featured = await getFeaturedByCategory();
  const tileImageByCat = new Map<string, string | null>();
  for (const f of featured) {
    tileImageByCat.set(f.category.id, productPrimaryImage(f.product));
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-dream-ink sm:text-3xl">
          Shop all
        </h1>
        <p className="mt-1 text-sm text-dream-muted">
          Pick a blank, make it yours. Every product is ready to customize in the
          designer.
        </p>
      </header>

      {/* Category tiles — 4 majors + an "All Products" catch-all (§3.3.1). */}
      <CategoryTiles
        majors={majors}
        tileImageByCat={tileImageByCat}
        activeSlug={category}
        allActive={!category}
      />

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-10">
        <aside className="lg:w-60 lg:shrink-0">
          <div className="lg:sticky lg:top-20">
            <ShopSidebar categories={categories} activeSlug={category} />
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {filtered ? (
            <FilteredView category={category} search={search} />
          ) : (
            <DefaultView majors={majors} featured={featured} />
          )}
        </section>
      </div>
    </main>
  );
}

/* ----------------------------- Default view ----------------------------- */
/* Top-5 favourites row, then the client tab strip swapping the grid in place. */

async function DefaultView({
  majors,
  featured,
}: {
  majors: CategoryRow[];
  featured: { category: CategoryRow; product: ProductRow }[];
}) {
  // Pre-fetch each major's products on the server so the client tabs swap
  // without a navigation. Plus an "All Products" virtual tab.
  const perMajor = await Promise.all(
    majors.map(async (m) => ({
      category: m,
      products: await getActiveProducts({ categorySlug: m.slug, limit: 12 }),
    })),
  );
  const allProducts = await getActiveProducts({ sort: "featured", limit: 24 });

  const tabs: CategoryTab[] = [
    { value: "all", label: "All Products", products: allProducts },
    ...perMajor.map((p) => ({
      value: p.category.slug,
      label: p.category.name,
      products: p.products,
    })),
  ];

  const empty = allProducts.length === 0;

  return (
    <div className="flex flex-col gap-10">
      {featured.length > 0 && (
        <div>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-dream-ink">
              Top picks
            </h2>
            <span className="text-xs text-dream-faint">
              One favourite per category
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {featured.map((f) => (
              <ProductCard key={f.product.id} product={f.product} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold text-dream-ink">
          Browse the catalog
        </h2>
        {empty ? (
          <EmptyState
            className="rounded-xl border border-dashed border-dream-line bg-dream-surface"
            title="No products yet — check back soon"
            description="We're still loading the catalog. New blanks land here as they're added."
          />
        ) : (
          <CategoryTabs tabs={tabs} />
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Filtered view ----------------------------- */
/* A specific category and/or a search term — server-rendered grid, no tabs.  */

async function FilteredView({
  category,
  search,
}: {
  category?: string;
  search?: string;
}) {
  const [cat, products] = await Promise.all([
    category ? getCategoryBySlug(category) : Promise.resolve(null),
    getActiveProducts({ categorySlug: category, search, sort: "featured" }),
  ]);

  const heading = search
    ? `Results for “${search}”`
    : cat?.name ?? "Products";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-dream-ink">
          {heading}
        </h2>
        <span className="text-sm text-dream-muted">
          {products.length} {products.length === 1 ? "product" : "products"}
        </span>
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
              className="inline-flex h-10 items-center rounded-lg bg-dream-purple px-4 text-sm font-medium text-white transition-colors hover:bg-dream-purple-dark"
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
  tileImageByCat,
  activeSlug,
  allActive,
}: {
  majors: CategoryRow[];
  tileImageByCat: Map<string, string | null>;
  activeSlug?: string;
  allActive: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {majors.map((cat) => (
        <Tile
          key={cat.id}
          href={`/shop?category=${cat.slug}`}
          label={cat.name}
          image={tileImageByCat.get(cat.id) ?? null}
          active={activeSlug === cat.slug}
        />
      ))}
      <Tile href="/shop" label="All Products" image={null} active={allActive} />
    </div>
  );
}

function Tile({
  href,
  label,
  image,
  active,
}: {
  href: string;
  label: string;
  image: string | null;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-28 items-end overflow-hidden rounded-xl border p-3 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
        active
          ? "border-dream-purple ring-1 ring-dream-purple/30"
          : "border-dream-line hover:border-dream-line-strong hover:shadow-sm",
        image ? "bg-dream-surface" : "bg-dream-lavender-soft",
      )}
    >
      {image && (
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 20vw"
          className="object-contain p-3 opacity-90 transition-transform duration-200 group-hover:scale-105"
        />
      )}
      <span
        className={cn(
          "relative z-10 rounded-md px-2 py-1 font-display text-sm font-semibold text-dream-ink",
          image && "bg-dream-surface/85 backdrop-blur-sm",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
