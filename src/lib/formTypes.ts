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

export type PrintMethod = "screen" | "embroidery" | "dtf" | "not-sure";

export type PrintLocation =
  | "front-center"
  | "back-center"
  | "left-chest"
  | "right-chest"
  | "sleeve-left"
  | "sleeve-right";

// One print the customer wants: where it goes and how many colours IT has.
// The quick quote builds an explicit list of these instead of asking for a
// location count plus one global colour count, so a job with a 3-colour front
// and a 1-colour back prices (and reads) honestly.
export type PrintSpec = {
  location: PrintLocation;
  /** Ink or thread colours in this one print. 5 means "5 or more". */
  colors: number;
};

export type QuoteFormData = {
  // Step 1, Contact
  name: string;
  email: string;
  phone: string;
  referralCode: string;

  // Step 2, Product
  productType: ProductType | "";
  garmentBrand: GarmentBrand | "";
  garmentColor: string;
  sizes: SizeBreakdown;
  sizesLater: boolean;
  quantity: string;

  // Step 3, Print
  prints: PrintSpec[];
  printMethod: PrintMethod;

  // Step 4, Artwork
  designDescription: string;

  // Step 5, Timeline
  neededBy: string;
  notes: string;
  priceMatchLink: string;

  // Attribution, how the customer found us (marketing source)
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

// Colour counts a single print can be quoted at. 5 stands for "5 or more",
// which is where the screen-print colour surcharge plateaus.
export const PRINT_COLOR_CHOICES = [1, 2, 3, 4, 5] as const;
export const MAX_PRINT_COLORS = 5;

export const PRINT_LOCATIONS: { value: PrintLocation; label: string }[] = [
  { value: "front-center", label: "Front center" },
  { value: "back-center", label: "Back center" },
  { value: "left-chest", label: "Left chest" },
  { value: "right-chest", label: "Right chest" },
  { value: "sleeve-left", label: "Left sleeve" },
  { value: "sleeve-right", label: "Right sleeve" },
];

export const PRINT_METHOD_OPTIONS: { value: PrintMethod; label: string }[] = [
  { value: "not-sure", label: "Not sure, Julian figures it out" },
  { value: "screen", label: "Screen print" },
  { value: "embroidery", label: "Embroidery" },
  { value: "dtf", label: "DTF" },
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
  prints: [],
  printMethod: "not-sure",
  designDescription: "",
  neededBy: "",
  notes: "",
  priceMatchLink: "",
  heardAbout: "",
};

/* ---------- Prints helpers (shared by the card, the API and emails) ---------- */

/** The list every new quote starts with: one front print, one colour. */
export function defaultPrints(): PrintSpec[] {
  return [{ location: "front-center", colors: 1 }];
}

/** Clamp any incoming colour count into the quotable 1..5 range. */
export function clampPrintColors(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.floor(n), 1), MAX_PRINT_COLORS);
}

export function printColorLabel(n: number): string {
  return n >= MAX_PRINT_COLORS ? `${MAX_PRINT_COLORS}+` : String(n);
}

export function printLocationLabel(loc: PrintLocation | string): string {
  return PRINT_LOCATIONS.find((l) => l.value === loc)?.label ?? String(loc);
}

/**
 * Next print to append: the first location that isn't spoken for yet, so
 * "Add another print" never starts on a duplicate.
 */
export function nextPrint(prints: PrintSpec[]): PrintSpec {
  const used = new Set(prints.map((p) => p.location));
  const free = PRINT_LOCATIONS.find((l) => !used.has(l.value)) ?? PRINT_LOCATIONS[0];
  return { location: free.value, colors: 1 };
}

/**
 * Distinct locations in the order the customer added them. This is what goes
 * into the `submissions.print_locations` text[] column, which is unchanged.
 */
export function printLocationValues(prints: PrintSpec[]): PrintLocation[] {
  return Array.from(new Set(prints.map((p) => p.location)));
}

/**
 * Readable one-liner for the `submissions.print_colors` text column and for
 * Julian's email, e.g. "Front center: 2 colours, Back center: 1 colour".
 */
export function summarizePrints(prints: PrintSpec[]): string {
  return prints
    .map((p) => {
      const count = clampPrintColors(p.colors);
      const noun = count === 1 ? "colour" : "colours";
      return `${printLocationLabel(p.location)}: ${printColorLabel(count)} ${noun}`;
    })
    .join(", ");
}

/** Sum the entries of a SizeBreakdown, ignoring anything non-numeric. */
export function sumSizes(sizes: SizeBreakdown): number {
  return SIZE_KEYS.reduce((total, k) => {
    const n = Number(sizes[k] ?? "");
    return total + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}
