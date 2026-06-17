import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductForDesign } from "@/lib/db/catalog";
import { getUser } from "@/lib/auth";
import { enabledColours } from "@/lib/productImage";
import { DesignerClient } from "./DesignerClient";
import type { ProductColourJson, ProductSizeJson, PrintAreaPositionJson } from "@/lib/db/rows";

export const metadata = { title: "Design — Dreamhouse Printing" };

export default async function DesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ quote?: string; design?: string }>;
}) {
  const { productId } = await params;
  const { quote } = await searchParams;
  const loaded = await getProductForDesign(productId);
  if (!loaded) notFound();

  const { product, printAreas, decorationMethods } = loaded;

  // A product with no print areas can't be designed (nowhere to place art).
  if (printAreas.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-dream-bg px-4 text-center">
        <h1 className="font-display text-2xl font-bold text-dream-ink">{product.name} isn’t set up for the designer yet</h1>
        <p className="mt-2 max-w-md text-dream-muted">
          This product is available by quote. Request a quote and we’ll help you lay out your design.
        </p>
        <Link href="/shop" className="mt-6 rounded-lg bg-dream-purple px-5 py-2.5 font-medium text-white">
          Back to shop
        </Link>
      </main>
    );
  }

  const user = await getUser();
  const colours = enabledColours(product) as ProductColourJson[];
  const allSizes = (product.sizes ?? []) as unknown as (ProductSizeJson & { enabled?: boolean })[];
  const sizes = allSizes.filter((s) => s.enabled !== false);

  return (
    <DesignerClient
      productId={product.id}
      productName={product.name}
      brand={product.brand}
      pricing={{
        wholesale_cost: product.wholesale_cost,
        base_price: product.base_price,
        markup_type: product.markup_type,
        markup_value: product.markup_value,
        pricing_rules: product.pricing_rules,
      }}
      leadTimeDays={product.lead_time_days}
      colours={colours}
      sizes={sizes.map((s) => ({ name: s.name, inStock: s.inStock }))}
      printAreas={printAreas.map((p) => ({
        id: p.id,
        name: p.name,
        view: p.view,
        position: p.position as unknown as PrintAreaPositionJson,
        maxWidthIn: p.max_width_in,
        maxHeightIn: p.max_height_in,
      }))}
      methods={decorationMethods.map((m) => ({
        id: m.id,
        name: m.name,
        setup_fee: m.setup_fee,
        per_unit_cost: m.per_unit_cost,
        per_color_cost: m.per_color_cost,
      }))}
      isLoggedIn={!!user}
      startAsQuote={quote === "1"}
    />
  );
}
