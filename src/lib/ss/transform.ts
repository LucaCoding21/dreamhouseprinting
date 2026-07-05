import "server-only";

import { ssGetStyle, ssGetProducts, ssImageUrl } from "./client";
import type {
  SSProduct,
  SSStyle,
  ProductColour,
  ProductSize,
  SSProductDraft,
} from "./types";

/** Strip S&S's HTML description down to readable text (keep <li> as bullets). */
function cleanDescription(html: string): string {
  if (!html) return "";
  return html
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Assemble normalized colours from the SKU list (one entry per distinct colour). */
export function coloursFromProducts(products: SSProduct[]): ProductColour[] {
  const byColour = new Map<string, SSProduct[]>();
  for (const p of products) {
    const list = byColour.get(p.colorName) ?? [];
    list.push(p);
    byColour.set(p.colorName, list);
  }
  const colours: ProductColour[] = [];
  for (const [name, skus] of byColour) {
    const rep = skus[0];
    const inStock = skus.some((s) => s.qty > 0);
    colours.push({
      name,
      hex: rep.color1 || "#cccccc",
      swatch: ssImageUrl(rep.colorSwatchImage),
      ssColorCode: rep.colorCode,
      inStock,
      images: {
        front: ssImageUrl(rep.colorFrontImage),
        back: ssImageUrl(rep.colorBackImage),
        side: ssImageUrl(rep.colorSideImage || rep.colorDirectSideImage),
        model: ssImageUrl(rep.colorOnModelFrontImage),
      },
    });
  }
  return colours;
}

/** Assemble normalized sizes (distinct, ordered by S&S sizeOrder). */
export function sizesFromProducts(products: SSProduct[]): ProductSize[] {
  const bySize = new Map<string, { size: ProductSize; inStock: boolean }>();
  for (const p of products) {
    const existing = bySize.get(p.sizeName);
    const inStock = p.qty > 0;
    if (existing) {
      existing.inStock = existing.inStock || inStock;
    } else {
      bySize.set(p.sizeName, {
        size: { name: p.sizeName, ssSizeCode: p.sizeCode, order: p.sizeOrder, inStock },
        inStock,
      });
    }
  }
  return [...bySize.values()]
    .map((v) => ({ ...v.size, inStock: v.inStock }))
    .sort((a, b) => a.order.localeCompare(b.order));
}

/** Representative wholesale cost — the lowest customer price across SKUs (base size). */
export function baseWholesaleCost(products: SSProduct[]): number {
  const prices = products.map((p) => p.customerPrice).filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : 0;
}

function buildPhotos(style: SSStyle, colours: ProductColour[]) {
  const photos: SSProductDraft["photos"] = [];
  const styleImg = ssImageUrl(style.styleImage);
  if (styleImg) photos.push({ src: styleImg, type: "style" });
  for (const c of colours.slice(0, 6)) {
    if (c.images.front) photos.push({ src: c.images.front, type: "flat", colorName: c.name, view: "front" });
  }
  return photos;
}

/** Fetch a style + its SKUs from S&S and assemble a normalized product draft. */
export async function buildProductDraft(styleId: string | number): Promise<SSProductDraft> {
  const [style, products] = await Promise.all([ssGetStyle(styleId), ssGetProducts(styleId)]);
  if (!style) throw new Error(`S&S style ${styleId} not found`);

  const colours = coloursFromProducts(products);
  const sizes = sizesFromProducts(products);
  const anyStock = colours.some((c) => c.inStock);

  return {
    ssStyleId: String(style.styleID),
    ssPartNumber: style.partNumber,
    ssStyleName: style.styleName,
    brand: style.brandName,
    name: style.title || style.styleName,
    description: cleanDescription(style.description),
    baseCategory: style.baseCategory,
    photos: buildPhotos(style, colours),
    colours,
    sizes,
    wholesaleCost: baseWholesaleCost(products),
    stockStatus: anyStock ? "in_stock" : "out_of_stock",
  };
}
