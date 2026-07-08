export type ProductType =
  | "t-shirts"
  | "hoodies"
  | "crewnecks"
  | "hats"
  | "tote-bags"
  | "other";

export type GarmentBrand =
  | "gildan"
  | "bella-canvas"
  | "comfort-colors"
  | "no-preference";

export type SizeKey = "S" | "M" | "L" | "XL" | "2XL" | "3XL";

// Value is a stringified integer so it maps cleanly to controlled inputs.
export type SizeBreakdown = Partial<Record<SizeKey, string>>;

export type PrintMethod = "screen" | "embroidery" | "dtg" | "not-sure";

export type PrintLocation =
  | "front-center"
  | "back-center"
  | "left-chest"
  | "right-chest"
  | "sleeve-left"
  | "sleeve-right";

// One decorated spot: where it goes + how many print colours it uses. Colours
// are only meaningful for screen print (embroidery is priced by location), so
// for embroidery `colors` is carried but ignored by pricing.
export type PrintPlacement = { location: PrintLocation; colors: number };

export type QuoteFormData = {
  // Step 1 — Contact
  name: string;
  email: string;
  phone: string;
  referralCode: string;

  // Step 2 — Product
  productType: ProductType | "";
  garmentBrand: GarmentBrand | "";
  garmentColor: string;
  sizes: SizeBreakdown;
  sizesLater: boolean;
  quantity: string;

  // Step 3 — Print
  // `placements` is the source of truth: per-location colour detail. The flat
  // `printColors` / `printLocations` are kept as derived legacy fields (existing
  // DB columns + back-compat) — see derivePrint().
  placements: PrintPlacement[];
  printColors: string;
  printLocations: PrintLocation[];
  printMethod: PrintMethod;

  // Step 4 — Artwork
  designDescription: string;

  // Step 5 — Timeline
  neededBy: string;
  notes: string;
  priceMatchLink: string;

  // Attribution — how the customer found us (marketing source)
  heardAbout: string;
};

export const HEARD_ABOUT_OPTIONS = [
  "Google search",
  "AI assistant (ChatGPT, etc.)",
  "Instagram / TikTok",
  "Friend or referral",
  "Returning customer",
  "Other",
] as const;

export const PRODUCT_OPTIONS: { value: ProductType; label: string }[] = [
  { value: "t-shirts", label: "T-shirts" },
  { value: "hoodies", label: "Hoodies" },
  { value: "crewnecks", label: "Crewnecks" },
  { value: "hats", label: "Hats" },
  { value: "tote-bags", label: "Tote bags" },
  { value: "other", label: "Other" },
];

export const GARMENT_BRAND_OPTIONS: {
  value: GarmentBrand;
  label: string;
  hint: string;
}[] = [
  { value: "gildan", label: "Gildan", hint: "Budget" },
  { value: "bella-canvas", label: "Bella+Canvas", hint: "Mid" },
  { value: "comfort-colors", label: "Comfort Colors", hint: "Premium" },
  { value: "no-preference", label: "No preference", hint: "Julian picks" },
];

export const SIZE_KEYS: SizeKey[] = ["S", "M", "L", "XL", "2XL", "3XL"];

export const GARMENT_COLORS = [
  "Black",
  "White",
  "Heather Grey",
  "Navy",
  "Red",
  "Forest Green",
  "Royal Blue",
  "Sand",
  "Pink",
];

export const PRINT_COLOR_OPTIONS = ["1", "2", "3", "4+"];

export const PRINT_LOCATIONS: { value: PrintLocation; label: string }[] = [
  { value: "front-center", label: "Front center" },
  { value: "back-center", label: "Back center" },
  { value: "left-chest", label: "Left chest" },
  { value: "right-chest", label: "Right chest" },
  { value: "sleeve-left", label: "Left sleeve" },
  { value: "sleeve-right", label: "Right sleeve" },
];

export const PRINT_LOCATION_LABEL: Record<PrintLocation, string> =
  Object.fromEntries(
    PRINT_LOCATIONS.map((l) => [l.value, l.label]),
  ) as Record<PrintLocation, string>;

// Colour count shown to the customer (screen caps at "5+").
export function colorLabel(colors: number): string {
  return colors >= 5 ? "5+" : String(Math.max(1, colors));
}

export const PRINT_METHOD_OPTIONS: { value: PrintMethod; label: string }[] = [
  { value: "not-sure", label: "Not sure — Julian figures it out" },
  { value: "screen", label: "Screen print" },
  { value: "embroidery", label: "Embroidery" },
  { value: "dtg", label: "DTG" },
];

export const emptyFormData: QuoteFormData = {
  name: "",
  email: "",
  phone: "",
  referralCode: "",
  productType: "",
  garmentBrand: "no-preference",
  garmentColor: "",
  sizes: {},
  sizesLater: false,
  quantity: "",
  placements: [],
  printColors: "",
  printLocations: [],
  printMethod: "not-sure",
  designDescription: "",
  neededBy: "",
  notes: "",
  priceMatchLink: "",
  heardAbout: "",
};

/** Sum the entries of a SizeBreakdown, ignoring anything non-numeric. */
export function sumSizes(sizes: SizeBreakdown): number {
  return SIZE_KEYS.reduce((total, k) => {
    const n = Number(sizes[k] ?? "");
    return total + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

// Derive the legacy flat fields from the per-location placements so the existing
// DB columns and any old readers keep working. `printColors` becomes the max
// colour count across locations (the screen-heavy spot), which matches how the
// single-value field was interpreted before.
export function derivePrint(placements: PrintPlacement[]): {
  printColors: string;
  printLocations: PrintLocation[];
} {
  if (placements.length === 0) return { printColors: "", printLocations: [] };
  const maxColors = placements.reduce((m, p) => Math.max(m, p.colors), 1);
  return {
    printColors: maxColors >= 4 ? "4+" : String(maxColors),
    printLocations: placements.map((p) => p.location),
  };
}
