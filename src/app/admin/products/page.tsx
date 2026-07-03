import { requirePermission } from "@/lib/auth";
import { getAdminProducts, getAllCategories } from "@/lib/admin/queries";
import { ProductsClient } from "./ProductsClient";

export const metadata = { title: "Products | Admin" };

export default async function AdminProductsPage() {
  await requirePermission("products.manage");
  const [products, categories] = await Promise.all([getAdminProducts(), getAllCategories()]);

  return <ProductsClient products={products} categories={categories} />;
}
