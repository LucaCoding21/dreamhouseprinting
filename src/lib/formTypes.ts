export type ProductType =
  | "t-shirts"
  | "hoodies"
  | "crewnecks"
  | "hats"
  | "tote-bags"
  | "other";

export type PrintMethod = "screen" | "embroidery" | "dtg" | "not-sure";

export type PrintLocation =
  | "front-center"
  | "back-center"
  | "left-chest"
  | "right-chest"
  | "sleeve-left"
  | "sleeve-right";

export type QuoteFormData = {
  // Step 1 — Contact
  name: string;
  email: string;
  phone: string;
  referralCode: string;

  // Step 2 — Product
  productType: ProductType | "";
  garmentColor: string;
  quantity: string;

  // Step 3 — Print
  printColors: string;
  printLocations: PrintLocation[];
  printMethod: PrintMethod;

  // Step 4 — Artwork
  designDescription: string;

  // Step 5 — Timeline
  neededBy: string;
  notes: string;
};

export const PRODUCT_OPTIONS: { value: ProductType; label: string }[] = [
  { value: "t-shirts", label: "T-shirts" },
  { value: "hoodies", label: "Hoodies" },
  { value: "crewnecks", label: "Crewnecks" },
  { value: "hats", label: "Hats" },
  { value: "tote-bags", label: "Tote bags" },
  { value: "other", label: "Other" },
];

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
  garmentColor: "",
  quantity: "",
  printColors: "",
  printLocations: [],
  printMethod: "not-sure",
  designDescription: "",
  neededBy: "",
  notes: "",
};
