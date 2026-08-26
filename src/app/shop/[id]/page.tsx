import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProductById,
  getActiveProducts,
  getCategories,
  getActiveDecorationMethods,
} from "@/lib/db/catalog";
import type { ProductSizeJson, ProductPhotoJson, ProductQuoteCurveJson } from "@/lib/db/rows";
import { enabledColours } from "@/lib/productImage";
import {
  shopPrice,
  curveForProduct,
  startingFromCurve,
  allowedCurveDecorations,
  decorationForMethodSlug,
} from "@/lib/pricing/quote";
import { ProductGallery } from "./ProductGallery";
import { ProductCard } from "@/components/storefront/ProductCard";
import { HelpPrompt } from "@/components/support/HelpPrompt";
import { getProfile, isStaff } from "@/lib/auth";

/**
 * Staff can open this page for an INACTIVE product as a 1:1 draft preview
 * (the admin editor's "Preview in shop" button). Same code path, same data
 * shape, just without the is_active gate. RLS backstops it: anonymous
 * visitors can't even SELECT an inactive product row, so the app-level
 * check here is defence in depth, not the only lock.
 */
async function canView(product: { is_active: boolean } | null): Promise<boolean> {
  if (!product) return false;
  if (product.is_active) return true;
  return isStaff(await getProfile());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product || !(await canView(product))) return { title: "Product | Dreamhouse Printing" };
  return {
    title: `${product.name} | Dreamhouse Printing`,
    description:
      product.description ??
      `Customize the ${product.name}, pick a colour, add your art, and we'll print it.`,
  };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const product = await getProductById(id);
  if (!product || !(await canView(product))) notFound();
  const draftPreview = !product.is_active;

  const colours = enabledColours(product);
  const allSizes = (product.sizes ?? []) as unknown as (ProductSizeJson & {
    enabled?: boolean;
  })[];
  const sizes: ProductSizeJson[] = allSizes.filter((s) => s.enabled !== false);
  const photos = (product.photos ?? []) as unknown as ProductPhotoJson[];
  const extraPhotos = photos.map((p) => p.src).filter(Boolean);

  // Breadcrumb category (best-effort): resolve the product's category name.
  const categories = await getCategories();
  const cat = categories.find(
    (c) => c.id === product.category_id || c.id === product.subcategory_id,
  );

  // One fetch feeds both the "Next" link and "You might also like".
  const listing = await getActiveProducts({ sort: "featured" });

  // "Next" walks the listing order and wraps at the end. It used to be
  // related[0], i.e. the first featured product every time, so it bounced
  // between the same two items no matter where you started.
  const here = listing.findIndex((p) => p.id === product.id);
  const nextProduct =
    listing.length > 1 && here >= 0 ? listing[(here + 1) % listing.length] : null;

  // "You might also like", other active products, current one removed.
  const related = listing.filter((p) => p.id !== product.id).slice(0, 5);

  const quoteCurve =
    ((product.pricing_rules as { quote?: ProductQuoteCurveJson } | null)?.quote ??
      null) as ProductQuoteCurveJson | null;

  // Decoration methods this product actually offers customers: the admin's
  // per-product toggles (allowed_decoration_method_ids), and, when the product
  // is curve-priced, only methods the curve can price (mirrors the designer).
  const methods = await getActiveDecorationMethods();
  const allowedIds = new Set((product.allowed_decoration_method_ids ?? []) as string[]);
  const allowedSlugs = methods.filter((m) => allowedIds.has(m.id)).map((m) => m.slug);
  const curve = curveForProduct(product);
  const offeredDecorations = curve ? allowedCurveDecorations(curve, allowedSlugs) : null;
  const offeredMethodNames = methods
    .filter((m) => allowedIds.has(m.id))
    .filter((m) => {
      if (!curve) return true;
      const d = decorationForMethodSlug(m.slug);
      return d !== null && (curve.breaks[d] ?? []).length > 0;
    })
    .map((m) => m.name);

  const starting =
    curve && offeredDecorations
      ? { amount: startingFromCurve(curve, offeredDecorations), label: "as low as" as const }
      : shopPrice(product);

  // "Back to shop" returns to the listing the user came from (carried via ?from=,
  // so it preserves their category / search / sort). Only trust internal /shop
  // URLs; otherwise fall back to the product's own category.
  const backHref =
    from && from.startsWith("/shop")
      ? from
      : cat
        ? `/shop?category=${cat.slug}`
        : "/shop";

  // Name the destination: "Back to Shirts" tells you where the link lands, and
  // it is the listing you actually came from. Only when the URL carries a
  // category, though: a search or the full catalogue has no honest short name,
  // so those stay "Back to shop".
  const backCategorySlug =
    from && from.startsWith("/shop")
      ? new URLSearchParams(from.split("?")[1] ?? "").get("category")
      : (cat?.slug ?? null);
  const backCategory = backCategorySlug
    ? categories.find((c) => c.slug === backCategorySlug)
    : null;
  const backLabel = backCategory ? `Back to ${backCategory.name}` : "Back to shop";

  return (
    <main className="mx-auto max-w-[94rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      {/* Staff-only draft preview marker. A fixed overlay so the page itself
          renders exactly as customers will see it once the product goes live. */}
      {draftPreview && (
        <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-dream-ink px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(27,20,88,0.35)]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-dream-sun" aria-hidden="true" />
            <span>Draft preview. Customers can&apos;t see this page yet.</span>
            <Link
              href={`/admin/products/${product.id}`}
              className="rounded-full bg-white/15 px-3 py-1 text-[14px] font-semibold whitespace-nowrap transition-colors hover:bg-white/25"
            >
              Back to editor
            </Link>
          </div>
        </div>
      )}

      {/* Back to shop (left) + Next product (right) */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-dream-muted transition-colors hover:text-dream-purple"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {backLabel}
        </Link>
        {/* Phones only: on desktop the "You might also like" grid at the foot of
            the page already does this job, and better (it shows what you're
            moving to). On a phone that grid is a long scroll away. */}
        {nextProduct && (
          <Link
            href={
              from
                ? `/shop/${nextProduct.id}?from=${encodeURIComponent(from)}`
                : `/shop/${nextProduct.id}`
            }
            className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-dream-muted transition-colors hover:text-dream-purple lg:hidden"
            title={nextProduct.name}
          >
            <span className="truncate">
              Next: {nextProduct.name}
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        )}
      </div>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-dream-muted sm:mb-10">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-dream-ink">
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-dream-faint">/</li>
          <li>
            <Link href="/shop" className="hover:text-dream-ink">
              Products
            </Link>
          </li>
          {cat && (
            <>
              <li aria-hidden="true" className="text-dream-faint">/</li>
              <li>
                <Link
                  href={`/shop?category=${cat.slug}`}
                  className="hover:text-dream-ink"
                >
                  {cat.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true" className="text-dream-faint">/</li>
          <li className="truncate font-medium text-dream-ink">{product.name}</li>
        </ol>
      </nav>

      {/* Interactive gallery + buy box */}
      <ProductGallery
        productId={product.id}
        ssStyleId={product.ss_style_id}
        brand={product.brand}
        sku={product.ss_part_number}
        name={product.name}
        colours={colours}
        sizes={sizes}
        extraPhotos={extraPhotos}
        startingPrice={starting.amount}
        quoteCurve={quoteCurve}
        allowedDecorations={offeredDecorations ?? undefined}
        decorationNames={offeredMethodNames}
        description={product.description}
        leadTimeDays={product.lead_time_days}
      />

      {/* Value props */}
      <ValueProps />

      {/* Help nudge, a person to ask before committing to a custom job */}
      <HelpPrompt
        title="Have a question about this product?"
        body="Have questions on sizing, colours, or decoration possibilities? Just ask us and a real person will give you the info you need :)"
        className="mt-6"
      />

      {/* You might also like */}
      {related.length > 0 && (
        <section className="mt-10 sm:mt-24">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[22px] font-bold text-dream-ink sm:text-3xl">
              You might also like
            </h2>
            <Link
              href="/shop"
              className="text-sm font-medium text-dream-purple hover:underline"
            >
              Shop all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/* ------------------------------ Value props ------------------------------ */

function ValueProps() {
  const props = [
    {
      title: "Price-match guarantee",
      desc: "We price match large shops like Coastal Reign and Get Bold.",
      icon: <ShieldIcon className="h-7 w-7" />,
      badge: "bg-dream-purple text-white",
      tilt: "-rotate-3",
    },
    {
      title: "Free art proof",
      desc: "See a digital mockup before we print a thing.",
      icon: <PencilIcon className="h-7 w-7" />,
      badge: "bg-dream-sun text-dream-ink",
      tilt: "rotate-3",
    },
    {
      title: "Local Vancouver delivery",
      desc: "Free drop-off across the city, printed in-house.",
      icon: <TruckIcon className="h-7 w-7" />,
      badge: "bg-dream-peach text-dream-ink",
      tilt: "-rotate-2",
    },
  ];
  return (
    <section className="mt-20 grid gap-3 sm:grid-cols-3">
      {props.map((p) => (
        <div
          key={p.title}
          className="rough-card group relative flex items-start gap-4 px-6 py-6 transition-transform duration-200 hover:-translate-y-1"
        >
          <span
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-[0_3px_0_0_rgba(27,20,88,0.22)] transition-transform duration-200 group-hover:rotate-0 ${p.badge} ${p.tilt}`}
          >
            {p.icon}
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-dream-ink">
              {p.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-dream-ink-soft">
              {p.desc}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function PencilIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function TruckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 18V6a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h2" />
      <path d="M14 9h4l3 3v5a1 1 0 0 1-1 1h-1" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
