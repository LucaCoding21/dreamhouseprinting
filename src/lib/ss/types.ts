/**
 * S&S Activewear v2 API response shapes (subset we consume). The shop runs on a
 * Canadian account, so the base URL is api-ca.ssactivewear.com (see ./client).
 * Image fields are CDN-relative paths (e.g. "Images/Color/34126_f_fm.jpg").
 */

export interface SSStyle {
  styleID: number;
  partNumber: string;
  brandName: string;
  styleName: string;        // e.g. "3001"
  uniqueStyleName: string;
  title: string;            // e.g. "Jersey Tee"
  description: string;      // HTML
  baseCategory: string;     // e.g. "T-Shirts - Premium"
  categories: string;       // csv of S&S category ids
  brandImage: string;
  styleImage: string;
  newStyle?: boolean;
}

export interface SSWarehouse {
  warehouseAbbr: string;    // "BC" | "ON" for CA
  qty: number;
  closeout: boolean;
}

export interface SSProduct {
  sku: string;
  styleID: number;
  brandName: string;
  styleName: string;
  colorName: string;
  colorCode: string;
  colorSwatchImage: string;
  colorFrontImage: string;
  colorBackImage: string;
  colorSideImage: string;
  colorDirectSideImage: string;
  colorOnModelFrontImage: string;
  colorOnModelBackImage: string;
  color1: string;           // hex, e.g. "#4298B5"
  color2: string;
  sizeName: string;         // "XS".."5XL"
  sizeCode: string;
  sizeOrder: string;        // "B0".."B8" — lexical sort = size order
  piecePrice: number;
  customerPrice: number;    // our wholesale cost
  salePrice: number;
  retailPrice: number;
  qty: number;              // total inventory across warehouses
  caseQty: number;
  warehouses: SSWarehouse[];
}

/** Normalized colour assembled from all SKUs of one colour. */
export interface ProductColour {
  name: string;
  hex: string;
  swatch: string | null;    // absolute CDN url
  ssColorCode: string;
  inStock: boolean;
  images: {
    front: string | null;
    back: string | null;
    side: string | null;
    model: string | null;
  };
}

/** Normalized size assembled from distinct SKUs. */
export interface ProductSize {
  name: string;
  ssSizeCode: string;
  order: string;
  inStock: boolean;
}

/** A product draft assembled from S&S, ready to merge into the products table. */
export interface SSProductDraft {
  ssStyleId: string;
  ssPartNumber: string;
  brand: string;
  name: string;
  description: string;
  baseCategory: string;
  photos: { src: string; type: string; colorName?: string; view?: string }[];
  colours: ProductColour[];
  sizes: ProductSize[];
  wholesaleCost: number;    // representative base cost (min customerPrice)
  stockStatus: "in_stock" | "out_of_stock" | "made_to_order";
}
