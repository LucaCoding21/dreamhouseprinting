import { requirePermission } from "@/lib/auth";
import { getAdminProducts, getAllCategories } from "@/lib/admin/queries";
import { ProductsClient } from "./ProductsClient";

export const metadata = { title: "Products | Admin" };

export default async function AdminProductsPage() {
  const [, products, categories] = await Promise.all([
    requirePermission("products.manage"),
    getAdminProducts(),
    getAllCategories(),
  ]);

  return <ProductsClient products={products} categories={categories} />;
}
