import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getAdminProduct, getAllCategories, getAllDecorationMethods, getCurveSources } from "@/lib/admin/queries";
import { ProductEditor } from "./ProductEditor";

export const metadata = { title: "Edit product | Admin" };

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("products.manage");
  const { id } = await params;

  const [loaded, categories, methods, curveSources] = await Promise.all([
    getAdminProduct(id),
    getAllCategories(),
    getAllDecorationMethods(),
    getCurveSources(),
  ]);
  if (!loaded) notFound();

  return (
    <ProductEditor
      product={loaded.product}
      printAreas={loaded.printAreas}
      categories={categories}
      methods={methods}
      curveSources={curveSources.filter((c) => c.id !== id)}
    />
  );
}
