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
import { Collapsible } from "@/components/storefront/Collapsible";
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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-dream-muted">
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
        name={product.name}
        colours={colours}
        sizes={sizes}
        extraPhotos={extraPhotos}
        startingPrice={starting}
      />

      {/* Collapsible info sections */}
      <div className="mt-8 max-w-3xl">
        <Collapsible title="Product details" defaultOpen>
          {product.description ? (
            <p>{product.description}</p>
          ) : (
            <p>
              A custom-ready blank, decorated in-house. Choose your colour and
              sizes, then add artwork in the designer — screenprint, embroidery,
              or DTG depending on the piece.
            </p>
          )}
        </Collapsible>
        <Collapsible title="Shipping & turnaround">
          <p>
            Ships in ~{product.lead_time_days} business day
            {product.lead_time_days === 1 ? "" : "s"} once your proof is
            approved. Local Vancouver pickup is available — choose it at
            checkout to skip shipping.
          </p>
        </Collapsible>
      </div>

      {/* Value props */}
      <ValueProps />

      {/* You might also like */}
      {related.length > 0 && (
        <section className="mt-14">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-dream-ink">
              You might also like
            </h2>
            <Link
              href="/shop"
              className="text-sm font-medium text-dream-purple hover:underline"
            >
              Shop all →
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
    },
    {
      title: "Free art proof",
      desc: "See a digital mockup before we print a thing.",
      icon: <PencilIcon className="h-5 w-5" />,
    },
    {
      title: "Local Vancouver delivery",
      desc: "Free drop-off across the city, printed in-house.",
      icon: <TruckIcon className="h-5 w-5" />,
    },
  ];
  return (
    <section className="mt-12 grid gap-4 sm:grid-cols-3">
      {props.map((p) => (
        <div
          key={p.title}
          className="flex flex-col items-center gap-2 rounded-[2rem] bg-dream-lavender-soft px-6 py-8 text-center"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-dream-surface text-dream-purple">
            {p.icon}
          </span>
          <h3 className="font-display text-sm font-semibold text-dream-ink">
            {p.title}
          </h3>
          <p className="max-w-[16rem] text-xs text-dream-ink-soft">{p.desc}</p>
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
