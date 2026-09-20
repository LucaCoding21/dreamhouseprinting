import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getAdminProduct, getAllCategories, getAllDecorationMethods, getPricingProfileRows } from "@/lib/admin/queries";
import { ProductEditor } from "./ProductEditor";

export const metadata = { title: "Edit product | Admin" };

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [, loaded, categories, methods, profiles] = await Promise.all([
    requirePermission("products.manage"),
    getAdminProduct(id),
    getAllCategories(),
    getAllDecorationMethods(),
    getPricingProfileRows(),
  ]);
  if (!loaded) notFound();

  return (
    <ProductEditor
      product={loaded.product}
      printAreas={loaded.printAreas}
      categories={categories}
      methods={methods}
      profiles={profiles}
    />
  );
}
