import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProductById,
  getActiveProducts,
  getCategories,
} from "@/lib/db/catalog";
import type { ProductSizeJson, ProductPhotoJson } from "@/lib/db/rows";
import { enabledColours } from "@/lib/productImage";
import { startingAtPrice } from "@/lib/pricing/platform";
import { ProductGallery } from "./ProductGallery";
import { ProductCard } from "@/components/storefront/ProductCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product || !product.is_active) return { title: "Product — Dreamhouse Printing" };
  return {
    title: `${product.name} — Dreamhouse Printing`,
    description:
      product.description ??
      `Customize the ${product.name} — pick a colour, add your art, and we'll print it.`,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product || !product.is_active) notFound();

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

  // "You might also like" — other active products, current one removed.
  const related = (await getActiveProducts({ sort: "featured", limit: 6 }))
    .filter((p) => p.id !== product.id)
    .slice(0, 5);

  const starting = startingAtPrice(product);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      {/* Back to shop */}
      <Link
        href={cat ? `/shop?category=${cat.slug}` : "/shop"}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-dream-ink transition-colors hover:text-dream-purple"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to shop
      </Link>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-10 text-sm text-dream-muted">
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
        brand={product.brand}
        sku={product.ss_part_number}
        name={product.name}
        colours={colours}
        sizes={sizes}
        extraPhotos={extraPhotos}
        startingPrice={starting}
        description={product.description}
        leadTimeDays={product.lead_time_days}
      />

      {/* Value props */}
      <ValueProps />

      {/* You might also like */}
      {related.length > 0 && (
        <section className="mt-24">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-dream-ink">
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
      desc: "Find it cheaper in Vancouver and we'll match it.",
      icon: <ShieldIcon className="h-5 w-5" />,
      badge: "bg-dream-purple text-white",
      tilt: "-rotate-3",
    },
    {
      title: "Free art proof",
      desc: "See a digital mockup before we print a thing.",
      icon: <PencilIcon className="h-5 w-5" />,
      badge: "bg-dream-sun text-dream-ink",
      tilt: "rotate-3",
    },
    {
      title: "Local Vancouver delivery",
      desc: "Free drop-off across the city, printed in-house.",
      icon: <TruckIcon className="h-5 w-5" />,
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
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-[0_3px_0_0_rgba(27,20,88,0.22)] transition-transform duration-200 group-hover:rotate-0 ${p.badge} ${p.tilt}`}
          >
            {p.icon}
          </span>
          <div>
            <h3 className="font-display text-[15px] font-bold text-dream-ink">
              {p.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-dream-ink-soft">
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
