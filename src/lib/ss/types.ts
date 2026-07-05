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

/** One size-spec measurement row from GET /specs/?style=… (e.g. Body Length of size M). */
export interface SSSpec {
  specID: number;
  styleID: number;
  brandName: string;
  styleName: string;  // e.g. "3001"
  sizeName: string;   // "XS".."5XL" | "One Size" | "M/L"
  sizeOrder: string;  // "B0".. — lexical sort = size order
  specName: string;   // "Body Length" | "Chest Width (Laid Flat)" | …
  value: string;      // measurement value, usually inches
}

/** Pivoted size guide: ordered sizes × measurement columns, ready to render as a table. */
export interface SizeGuide {
  styleName: string;            // e.g. "3001"
  brandName: string;
  columns: string[];            // measurement names, in display order
  /** One row per size (already ordered); `values` keyed by column name. */
  rows: { size: string; values: Record<string, string> }[];
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
  ssStyleName: string;      // human style number, e.g. "5000" — what a printer orders by
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
