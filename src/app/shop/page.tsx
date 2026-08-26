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
import {
  ShopQtyProvider,
  ShopQtyControl,
} from "@/components/storefront/ShopQuantity";
import { EmptyState } from "@/components/ui";
import { shopPrice } from "@/lib/pricing/quote";
import { cn } from "@/lib/cn";

interface ShopSearchParams {
  category?: string;
  search?: string;
  brand?: string;
  sort?: string;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}) {
  const { category, search, brand, sort } = await searchParams;
  const filtered = Boolean(category || search || brand);

  const [categories, majors] = await Promise.all([
    getCategories(),
    getMajorCategories(),
  ]);

  // Subcategories to offer on mobile: the children of whichever major is in
  // play (either selected directly, or the parent of a selected child).
  const activeCat = category ? categories.find((c) => c.slug === category) : undefined;
  const activeMajorId = activeCat ? activeCat.parent_id ?? activeCat.id : undefined;
  const subs = activeMajorId
    ? categories
        .filter((c) => c.parent_id === activeMajorId)
        .sort((a, b) => a.display_order - b.display_order)
    : [];
  const activeMajorSlug = activeMajorId
    ? categories.find((c) => c.id === activeMajorId)?.slug
    : undefined;

  return (
    <main className="pb-6 sm:pb-8">
      {/* ---- Hero band: playful lavender, doodles, wavy bottom edge ---- */}
      {/* Phones get no lavender band and no wave: the hero sits on the same
          cream as the catalog, so the page reads as one surface and the
          products start higher. The playful band stays from sm up. */}
      <section className="relative overflow-hidden bg-[#f8f7fd] sm:bg-dream-lavender-soft">
        <div className="relative z-10 mx-auto max-w-[96rem] px-4 pb-4 pt-10 sm:px-6 sm:pb-28 sm:pt-14">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
            <div className="relative">
              <h1 className="font-display font-extrabold text-[26px] leading-[0.95] tracking-tight text-dream-ink sm:text-4xl lg:text-5xl">
                Shop Custom Apparel
              </h1>
              {/* Subtitle is desktop-only: on a phone it cost two lines of the
                  fold for copy the shopper does not need before browsing. */}
              <p className="mt-5 hidden max-w-sm text-[15px] leading-relaxed text-dream-ink-soft sm:block">
                Pick a blank, customize it in our designer, and get a free proof before we print.
              </p>
              <TitleUnderline className="mt-2 hidden h-auto w-44 sm:block sm:w-72" />
            </div>
            <div className="flex w-full items-center gap-2.5 lg:w-auto lg:-translate-y-12">
              <ShopSearch />
              <SortSelect value={sort ?? "featured"} />
            </div>
          </header>
        </div>
        <HeroWave />
      </section>

      {/* ---- Body: category tiles + sidebar + grid, on cream ---- */}
      <div className="relative mx-auto mt-4 max-w-[96rem] px-4 sm:-mt-16 sm:px-6">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
        {/* The full category tree is a desktop pattern. On a phone it dumped
            ~800px of links (every subcategory, always expanded) above the
            first product, so it is hidden below lg in favour of the chip row
            inside the grid column. */}
        <aside className="hidden lg:block lg:w-72 lg:shrink-0">
          <div className="lg:sticky lg:top-32">
            <ShopSidebar categories={categories} activeSlug={category} />
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {/* Mobile: one scrolling chip row (+ subcategories once a major is
              picked). Desktop: the icon tiles, alongside the sidebar. */}
          <CategoryChips
            majors={majors}
            subs={subs}
            activeSlug={category}
            activeMajorSlug={activeMajorSlug}
          />
          <div className="hidden lg:block">
            {/* Category tiles, 4 majors + an "All Products" catch-all (§3.3.1). */}
            <CategoryTiles
              majors={majors}
              activeSlug={category}
              allActive={!category}
            />
          </div>

          <div className="mt-8">
            <ShopQtyProvider>
              {filtered ? (
                <FilteredView category={category} search={search} brand={brand} sort={sort} />
              ) : (
                <DefaultView sort={sort} />
              )}
            </ShopQtyProvider>
          </div>
        </section>
      </div>
      </div>
    </main>
  );
}

/* --------------------------- Hero decorations ---------------------------- */
/* Hand-drawn title underline + wavy bottom edge, matching the playful        */
/* home-page treatment. Purely decorative (aria-hidden).                      */

function TitleUnderline({ className }: { className?: string }) {
  // Hand-drawn underline asset (public/shop-underline.svg), colour baked in.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/shop-underline.svg" alt="" aria-hidden className={className} />;
}

function HeroWave() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-36 w-full text-[#f8f7fd] sm:block sm:h-60 md:h-[18rem]"
      viewBox="0 0 1440 240"
      fill="none"
      preserveAspectRatio="none"
    >
      {/* Cream arcs up in a gentle curve over the title on the left (high enough
          to keep the text on cream, no flat plateau), then rolls through a smooth,
          shallow trough and a soft wide hump before settling low on the right
          (clear of the search). Gentle slopes, no deep or sharp valleys. */}
      <path
        d="M0 36C220 14 380 8 480 10 600 13 680 24 760 50 830 76 870 108 940 108 1010 108 1040 84 1120 84 1200 84 1245 150 1330 162 1385 168 1418 185 1440 192V240H0Z"
        fill="currentColor"
      />
    </svg>
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
      ? [...fetched].sort((a, b) => shopPrice(a).amount - shopPrice(b).amount)
      : sort === "price-desc"
        ? [...fetched].sort((a, b) => shopPrice(b).amount - shopPrice(a).amount)
        : fetched;
  const empty = allProducts.length === 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold text-dream-ink">All products</h2>
          <span className="text-sm text-dream-muted">
            {allProducts.length} {allProducts.length === 1 ? "product" : "products"}
          </span>
        </div>
        <ShopQtyControl />
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
/* A specific category and/or a search term, server-rendered grid, no tabs.  */

async function FilteredView({
  category,
  search,
  brand,
  sort,
}: {
  category?: string;
  search?: string;
  brand?: string;
  sort?: string;
}) {
  const dbSort = sort === "name" ? "name" : sort === "newest" ? "newest" : "featured";
  const [cat, fetched] = await Promise.all([
    category ? getCategoryBySlug(category) : Promise.resolve(null),
    getActiveProducts({ categorySlug: category, search, brand, sort: dbSort }),
  ]);

  // Price sorts run on the computed "from" price (not a stored column).
  const products =
    sort === "price-asc"
      ? [...fetched].sort((a, b) => shopPrice(a).amount - shopPrice(b).amount)
      : sort === "price-desc"
        ? [...fetched].sort((a, b) => shopPrice(b).amount - shopPrice(a).amount)
        : fetched;

  const heading = search
    ? `Results for “${search}”`
    : brand
      ? `${brand} products`
      : cat?.name ?? "Products";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold text-dream-ink">{heading}</h2>
          <span className="text-sm text-dream-muted">
            {products.length} {products.length === 1 ? "product" : "products"}
          </span>
        </div>
        <ShopQtyControl />
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
              : "No products in this category right now, check back soon."
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

/* Mobile category nav. Replaces the sidebar tree + tile grid, which together
   pushed the first product roughly 1200px down a phone screen and showed the
   same five categories twice. One horizontal chip row keeps the categories a
   thumb-flick away and lets products start near the top; the subcategories
   still exist, they just cost nothing until a major is selected. */
function CategoryChips({
  majors,
  subs,
  activeSlug,
  activeMajorSlug,
}: {
  majors: CategoryRow[];
  subs: CategoryRow[];
  activeSlug?: string;
  /** Slug of the major in play, whether it or one of its children is selected. */
  activeMajorSlug?: string;
}) {
  // -mx/px pair lets the row bleed to the screen edge, so a partially visible
  // chip signals there is more to swipe.
  const row =
    "no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto scroll-pl-4 px-4 sm:-mx-6 sm:scroll-pl-6 sm:px-6";
  return (
    <div className="lg:hidden">
      <div className={row}>
        <Chip href="/shop" label="All" active={!activeSlug} />
        {majors.map((cat) => (
          <Chip
            key={cat.id}
            href={`/shop?category=${cat.slug}`}
            label={cat.name}
            /* Stays lit while a child is selected, so the row always shows
               where you are in the hierarchy. */
            active={activeMajorSlug === cat.slug}
          />
        ))}
      </div>
      {subs.length > 0 && activeMajorSlug && (
        <div className={cn(row, "mt-5 gap-4")}>
          {/* Leading "All" carries the selected state when the parent (not a
              child) is chosen. Without it nothing in this row is ever marked,
              so it reads as static text rather than a filter. Auto-selecting a
              real subcategory instead would silently narrow the results. */}
          <Chip
            href={`/shop?category=${activeMajorSlug}`}
            label="All"
            active={activeSlug === activeMajorSlug}
            subtle
          />
          {subs.map((cat) => (
            <Chip
              key={cat.id}
              href={`/shop?category=${cat.slug}`}
              label={cat.name}
              active={activeSlug === cat.slug}
              subtle
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  href,
  label,
  active,
  subtle,
}: {
  href: string;
  label: string;
  active: boolean;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 snap-start whitespace-nowrap font-display text-[14px] font-semibold transition-colors",
        subtle
          ? // Subcategories are plain text, not pills. Two stacked pill rows
            // read as two equal levels of navigation and looked heavy. The
            // active one gets a tab-style bar (border-b, offset by the padding)
            // rather than a text underline, so it sits clear of descenders.
            cn(
              "border-b-2 pb-2",
              active
                ? "border-dream-purple text-dream-purple"
                : "border-transparent text-dream-muted hover:text-dream-ink",
            )
          : cn(
              "rounded-full border px-4 py-2",
              active
                ? "border-dream-purple bg-dream-purple text-white"
                : "border-dream-line bg-white text-dream-ink hover:border-dream-lavender",
            ),
      )}
    >
      {label}
    </Link>
  );
}

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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-5">
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
  const iconBase = CATEGORY_ICON_FILES[slug] ?? CATEGORY_ICON_FILES.all;
  return (
    <Link
      href={href}
      className={cn(
        // White card, icon centered, label tucked at the bottom.
        "group flex aspect-[16/10] min-h-28 flex-col items-center justify-center gap-2.5 rounded-2xl border-2 bg-white p-3 transition-all duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
        active
          ? "border-dream-purple bg-dream-purple/[0.06] shadow-[0_6px_0_0_rgba(118,100,255,0.18)]"
          : "border-dream-line shadow-sm hover:border-dream-lavender hover:shadow-md",
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/shop-icons/${iconBase}-${active ? "active" : "inactive"}.svg`}
          alt=""
          aria-hidden
          className="h-full w-full object-contain"
        />
      </span>
      <span
        className={cn(
          "text-center font-display text-[14px] font-semibold leading-tight sm:text-sm",
          active ? "text-dream-purple" : "text-dream-ink",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

/* Category icon assets in public/shop-icons, keyed by category slug. Each has
   an `-active` (filled) and `-inactive` (outline) variant; the Tile picks one
   by state. Colour is baked into the SVGs, so no currentColor tinting. */
const CATEGORY_ICON_FILES: Record<string, string> = {
  all: "all",
  shirts: "shirts",
  hoodies: "hoodie",
  "hats-toques": "hat",
  totes: "bag",
};
