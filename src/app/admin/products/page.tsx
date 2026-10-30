import { requirePermission } from "@/lib/auth";
import { getAdminProducts, getAllCategories } from "@/lib/admin/queries";
import { ProductsClient } from "./ProductsClient";

export const metadata = { title: "Products | Admin" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string }>;
}) {
  const [, { tab, from }, products, categories] = await Promise.all([
    requirePermission("products.manage"),
    searchParams,
    getAdminProducts(),
    getAllCategories(),
  ]);

  return (
    <ProductsClient
      products={products}
      categories={categories}
      initialTab={tab === "categories" ? "categories" : "products"}
      fromProductId={from ?? null}
    />
  );
}
