import type { ProductRow, ProductColourJson, ProductPhotoJson } from "@/lib/db/rows";
import { heroColour } from "@/lib/swatch";

/**
 * A colour's card image. We show the on-model shot by default (a person wearing
 * the garment reads far better on the shop grid than a flat blank), falling back
 * to the flat front shot when S&S has no model photo. `view` (or the colour's
 * pinned `primaryView`) can force the flat lay instead.
 */
export function colourCardImage(
  colour: (Pick<ProductColourJson, "images"> & { primaryView?: "model" | "flat" }) | null | undefined,
  view?: "model" | "flat"
): string | null {
  if (!colour?.images) return null;
  const { model, front } = colour.images;
  const v = view ?? colour.primaryView ?? "model";
  return v === "flat" ? front ?? model ?? null : model ?? front ?? null;
}

/** Best representative image for a product card: the hero colour's model shot (else flat), else a photo, else null. */
export function productPrimaryImage(
  product: Pick<ProductRow, "photos" | "colours">
): string | null {
  const colours = (product.colours ?? []) as unknown as ProductColourJson[];
  const heroImg = colourCardImage(heroColour(colours));
  if (heroImg) return heroImg;
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
