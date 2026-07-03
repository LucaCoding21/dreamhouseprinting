/**
 * Garment brands we stock. `brand` is a short, unambiguous substring matched
 * (ilike) against the stored S&S brand name via /shop?brand=… — see the
 * `brand` filter in lib/db/catalog.ts. Keep in sync with the seeded catalog.
 * Shared by the nav dropdown (SiteNav) and the /brands index page.
 */
export interface BrandInfo {
  label: string;
  brand: string;
  blurb: string;
}

export const BRANDS: BrandInfo[] = [
  { label: "Bella+Canvas", brand: "Bella", blurb: "Soft, retail-fit tees and the famous 3001." },
  { label: "Gildan", brand: "Gildan", blurb: "Dependable, budget-friendly cotton classics." },
  { label: "Comfort Colors", brand: "Comfort Colors", blurb: "Heavyweight, garment-dyed vintage feel." },
  { label: "Next Level", brand: "Next Level", blurb: "Modern, fashion-forward blanks." },
  { label: "Independent Trading", brand: "Independent", blurb: "Heavyweight hoodies and fleece." },
  { label: "Flexfit", brand: "Flexfit", blurb: "Structured, stretch-fit caps." },
  { label: "Richardson", brand: "Richardson", blurb: "Trucker caps and headwear staples." },
  { label: "YP Classics", brand: "YP", blurb: "Yupoong classics: snapbacks and dad hats." },
  { label: "Sportsman", brand: "Sportsman", blurb: "Affordable everyday headwear." },
  { label: "Q-Tees", brand: "Q-Tees", blurb: "Canvas totes and bags." },
];

export const brandHref = (brand: string) => `/shop?brand=${encodeURIComponent(brand)}`;
