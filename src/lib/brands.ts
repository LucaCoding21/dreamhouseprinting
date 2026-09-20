/**
 * Garment brands we stock. `brand` is a short, unambiguous substring matched
 * (ilike) against the stored S&S brand name via /shop?brand=…, see the
 * `brand` filter in lib/db/catalog.ts. Keep in sync with the seeded catalog.
 * Shared by the nav dropdown (SiteNav) and the /brands index page.
 */
export type BrandCategory = "t-shirts" | "hoodies" | "headwear" | "bags";

export interface BrandInfo {
  label: string;
  brand: string;
  blurb: string;
  /** Real wordmark in /public/brands. Falls back to `monogram` when absent. */
  logo?: string;
  /** Short letterform, used when there is no logo file for the brand. */
  monogram: string;
  /** Which filter tabs this brand appears under on /brands. */
  categories: BrandCategory[];
  /** Renders the monogram in purple rather than ink, for visual rhythm. */
  accent?: boolean;
}

export const BRANDS: BrandInfo[] = [
  {
    label: "Bella+Canvas",
    logo: "/brands/bella-canvas.png",
    brand: "Bella",
    blurb: "Soft, retail-fit tees and the famous 3001.",
    monogram: "B+C",
    categories: ["t-shirts"],
    accent: true,
  },
  {
    label: "Gildan",
    logo: "/brands/gildan.png",
    brand: "Gildan",
    blurb: "Dependable, budget-friendly cotton classics.",
    monogram: "G",
    categories: ["t-shirts", "hoodies"],
  },
  {
    label: "Comfort Colors",
    logo: "/brands/comfort-colors.png",
    brand: "Comfort Colors",
    blurb: "Heavyweight, garment-dyed vintage feel.",
    monogram: "CC",
    categories: ["t-shirts"],
    accent: true,
  },
  {
    label: "Next Level",
    logo: "/brands/next-level.png",
    brand: "Next Level",
    blurb: "Modern, fashion-forward blanks.",
    monogram: "NL",
    categories: ["t-shirts"],
  },
  {
    label: "Independent Trading",
    logo: "/brands/independent.png",
    brand: "Independent",
    blurb: "Heavyweight hoodies and fleece.",
    monogram: "it",
    categories: ["hoodies"],
  },
  {
    label: "Flexfit",
    logo: "/brands/flexfit.png",
    brand: "Flexfit",
    blurb: "Structured, stretch-fit caps.",
    monogram: "F",
    categories: ["headwear"],
  },
  {
    label: "Richardson",
    logo: "/brands/richardson.png",
    brand: "Richardson",
    blurb: "Trucker caps and headwear staples.",
    monogram: "R",
    categories: ["headwear"],
  },
  {
    label: "YP Classics",
    brand: "YP",
    blurb: "Yupoong classics: snapbacks and dad hats.",
    monogram: "YP",
    categories: ["headwear"],
    accent: true,
  },
  {
    label: "Sportsman",
    brand: "Sportsman",
    blurb: "Affordable everyday headwear.",
    monogram: "S",
    categories: ["headwear"],
  },
  {
    label: "Q-Tees",
    brand: "Q-Tees",
    blurb: "Canvas totes and bags.",
    monogram: "Q",
    categories: ["bags"],
  },
];

/** Filter tabs on /brands, in display order. */
export const BRAND_TABS: { value: BrandCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "t-shirts", label: "T-Shirts" },
  { value: "hoodies", label: "Hoodies" },
  { value: "headwear", label: "Headwear" },
  { value: "bags", label: "Bags" },
];

export const brandHref = (brand: string) => `/shop?brand=${encodeURIComponent(brand)}`;
