import type { ProductRow, ProductColourJson, ProductPhotoJson } from "@/lib/db/rows";

/** Best representative image for a product card: first colour's front shot, else a photo, else null. */
export function productPrimaryImage(
  product: Pick<ProductRow, "photos" | "colours">
): string | null {
  const colours = (product.colours ?? []) as unknown as ProductColourJson[];
  const firstFront = colours.find((c) => c.images?.front)?.images.front;
  if (firstFront) return firstFront;
  const photos = (product.photos ?? []) as unknown as ProductPhotoJson[];
  const flat = photos.find((p) => p.type === "flat" || p.type === "style");
  return flat?.src ?? photos[0]?.src ?? null;
}

/** Colours the shop actually offers (enabled !== false), with S&S fallback if no flags set. */
export function enabledColours(product: Pick<ProductRow, "colours">): ProductColourJson[] {
  const colours = (product.colours ?? []) as unknown as (ProductColourJson & { enabled?: boolean })[];
  const withFlag = colours.filter((c) => c.enabled !== false);
  return withFlag.length ? withFlag : colours;
}
