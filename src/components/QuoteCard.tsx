"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  HEARD_ABOUT_OPTIONS,
  PRINT_COLOR_OPTIONS,
  PRINT_LOCATIONS,
  SIZE_KEYS,
  emptyFormData,
  sumSizes,
  type PrintLocation,
  type PrintMethod,
  type ProductType,
  type QuoteFormData,
  type SizeBreakdown,
  type SizeKey,
} from "@/lib/formTypes";
import {
  AVAILABLE_DECORATIONS,
  calculateQuote,
  DECORATION,
  MAX_LOCATIONS,
  roundDisplayPrice,
  type Decoration,
  type PricedProduct,
} from "@/lib/pricing";
import AnimatedPrice from "./AnimatedPrice";

// ─────────────────────────────────────────────────────────────────────────────
// The home page's all-in-one quote card. It starts as the price calculator
// (phase "calc"); locking in a price swaps the same card into the multi-step
// request form (phase "form"), carrying the calculator's picks across. There's
// no separate /quote page — this card owns the whole flow.
// ─────────────────────────────────────────────────────────────────────────────

const DREAM_LETTERS = ["D", "R", "E", "A", "M"] as const;
const LETTER_COLORS = ["#7664ff", "#ec3f9e", "#16b6a8", "#ecbb25", "#ff8a52"];
const DEFAULT_LETTER = "#2a1b8a";

// Products the calculator can price. The two headwear SKUs are separate because
// their prices differ materially (a dad cap runs ~$5/unit over a toque). "other"
// has no price data — it routes straight into the form for a manual quote.
type CalcProduct = PricedProduct | "other";

const CALC_PRODUCTS: { value: CalcProduct; label: string }[] = [
  { value: "t-shirts", label: "Shirt" },
  { value: "hoodies", label: "Hoodie" },
  { value: "crewnecks", label: "Crewneck" },
  { value: "tote-bags", label: "Tote" },
  { value: "toque", label: "Toque" },
  { value: "dad-cap", label: "Dad Cap" },
  { value: "other", label: "Other" },
];
const QUANTITY_PRESETS = [25, 50, 100, 250, 500] as const;

// Maps a calculator selection onto the form's coarser fields. Both headwear
// SKUs collapse to the form's single "hats" product; decoration is derived.
const TO_FORM: Record<
  CalcProduct,
  { productType: ProductType; printMethod: PrintMethod }
> = {
  "t-shirts": { productType: "t-shirts", printMethod: "screen" },
  hoodies: { productType: "hoodies", printMethod: "screen" },
  crewnecks: { productType: "crewnecks", printMethod: "screen" },
  "tote-bags": { productType: "tote-bags", printMethod: "screen" },
  toque: { productType: "hats", printMethod: "embroidery" },
  "dad-cap": { productType: "hats", printMethod: "embroidery" },
  other: { productType: "other", printMethod: "not-sure" },
};

// Preselect from category links like /?product=shirt#quick-quote (the old
// /quote?product=… landing pages now point here).
const PRODUCT_PARAM: Record<string, CalcProduct> = {
  shirt: "t-shirts",
  hoodie: "hoodies",
  crew: "crewnecks",
  crewneck: "crewnecks",
  hat: "toque",
  bag: "tote-bags",
  tote: "tote-bags",
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file
const ALLOWED_ARTWORK = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf",
  "application/postscript", // .ai / .eps
  "application/illustrator",
];

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// Format a North American phone as ###-###-#### as the user types. Strips
// non-digits, caps at 10 digits, and inserts dashes between the groups.
function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

const FORM_STEPS = [
  { title: "Garment details", subtitle: "Color, sizes, and where the print goes." },
  { title: "Upload your artwork", subtitle: "PNG, JPG, PDF, AI or EPS — whatever you've got." },
  { title: "Wrap it up", subtitle: "How to reach you and when you need it." },
] as const;

type StepIndex = 0 | 1 | 2;
type Phase = "calc" | "form";

export default function QuoteCard() {
  const [phase, setPhase] = useState<Phase>("calc");

  // Calculator state.
  const [calcProduct, setCalcProduct] = useState<CalcProduct>("t-shirts");
  const [quantity, setQuantity] = useState("50");
  const [useCustomQty, setUseCustomQty] = useState(false);
  const [printColors, setPrintColors] = useState("1");
  const [decoration, setDecoration] = useState<Decoration>("screen");
  const [locations, setLocations] = useState(1);

  // Form state.
  const [step, setStep] = useState<StepIndex>(0);
  const [data, setData] = useState<QuoteFormData>(emptyFormData);
  const [artworkFiles, setArtworkFiles] = useState<File[]>([]);
  const [priceMatchFiles, setPriceMatchFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [touchedNext, setTouchedNext] = useState(false);

  const artworkInputRef = useRef<HTMLInputElement | null>(null);
  const priceMatchInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Preselect the product from a ?product= hint (category links land here).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("product");
    if (p && PRODUCT_PARAM[p]) setCalcProduct(PRODUCT_PARAM[p]);
  }, []);

  // Keep the card in view as the user moves through form steps (it lives
  // mid-page, so scrolling the window to the top would be jarring).
  useEffect(() => {
    if (phase !== "form" || typeof window === "undefined") return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase, step]);

  // ---- Pricing (always derived from the calculator selection) ----
  const priced = calcProduct === "other" ? null : calcProduct;
  const availableDecos = priced ? AVAILABLE_DECORATIONS[priced] : [];
  // Use a decoration that's actually valid for the current product. If the
  // selected one isn't offered (e.g. switched to a hat), fall back to default.
  const effDecoration: Decoration = priced
    ? availableDecos.includes(decoration)
      ? decoration
      : DECORATION[priced]
    : "screen";

  // Keep the decoration pills in sync when the product changes under them.
  useEffect(() => {
    if (priced && !AVAILABLE_DECORATIONS[priced].includes(decoration)) {
      setDecoration(DECORATION[priced]);
    }
  }, [priced, decoration]);

  const isScreen = priced !== null && effDecoration === "screen";
  const colorCount = isScreen ? parseColorCount(printColors) : 0;
  const qtyNum = Math.max(0, parseInt(quantity, 10) || 0);
  const quote = priced
    ? calculateQuote(priced, qtyNum, colorCount, effDecoration, locations)
    : null;
  const perUnit = quote?.available ? quote.perUnit : 0;

  // "other" isn't a real SKU, so the form keeps the product + colors pickers;
  // priced products lock them (shown in the summary banner instead).
  const productLocked = calcProduct !== "other";

  // In the form phase the quantity is still editable (Total quantity field /
  // size breakdown), so the summary + sticky bar track the live effective
  // quantity, falling back to the locked-in qty while the field is empty.
  const formQty = data.sizesLater
    ? Math.max(0, parseInt(data.quantity, 10) || 0)
    : sumSizes(data.sizes);
  const effectiveQty = formQty > 0 ? formQty : qtyNum;
  // In the form, the user can change print locations directly, so the live
  // price follows how many they've picked (at least 1).
  const formLocations = Math.max(1, data.printLocations.length);
  const formQuote = priced
    ? calculateQuote(priced, effectiveQty, colorCount, effDecoration, formLocations)
    : null;
  const formPerUnit = formQuote?.available ? formQuote.perUnit : 0;

  const update = <K extends keyof QuoteFormData>(key: K, value: QuoteFormData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const toggleLocation = (loc: PrintLocation) => {
    setData((d) => ({
      ...d,
      printLocations: d.printLocations.includes(loc)
        ? d.printLocations.filter((l) => l !== loc)
        : [...d.printLocations, loc],
    }));
  };

  const lockIn = () => {
    const mapped = TO_FORM[calcProduct];
    const colorStr = isScreen
      ? colorCount >= 4
        ? "4+"
        : String(Math.max(1, colorCount))
      : "1";
    // Carry the chosen decoration into the form's print method (priced products
    // only; "other" keeps the form's "not-sure" default).
    const printMethod: PrintMethod = priced ? effDecoration : mapped.printMethod;
    // Pre-fill the form's print-location checkboxes to match the count the
    // calculator priced (first N locations), unless the user already has some.
    const prefillLocations = PRINT_LOCATIONS.slice(0, Math.max(1, locations)).map(
      (l) => l.value,
    );
    setData((d) => ({
      ...d,
      productType: mapped.productType,
      printMethod,
      printColors: productLocked ? colorStr : d.printColors,
      printLocations:
        productLocked && d.printLocations.length === 0
          ? prefillLocations
          : d.printLocations,
      quantity: String(qtyNum),
      sizesLater: true,
    }));
    setStep(0);
    setTouchedNext(false);
    setSubmitError(null);
    setPhase("form");
  };

  const editSelection = () => {
    setPhase("calc");
    setTouchedNext(false);
  };

  const stepErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!data.productType) errs.productType = "Pick what you're printing on.";
      if (!data.garmentColor.trim()) errs.garmentColor = "Give us a garment color.";
      if (data.sizesLater) {
        if (!data.quantity.trim()) errs.quantity = "How many pieces total?";
        else if (Number(data.quantity) <= 0) errs.quantity = "Quantity must be a positive number.";
      } else {
        const total = sumSizes(data.sizes);
        if (total <= 0) errs.sizes = "Enter at least one size count.";
      }
      if (!data.printColors) errs.printColors = "How many print colors?";
      if (data.printLocations.length === 0) errs.printLocations = "Pick at least one print location.";
    }
    if (step === 2) {
      if (!data.name.trim()) errs.name = "We need a name to put on your quote.";
      if (!data.email.trim()) errs.email = "Email is required so Julian can reply.";
      else if (!isValidEmail(data.email)) errs.email = "That email doesn't look right.";
      if (!data.phone.trim()) errs.phone = "Phone is required.";
    }
    return errs;
  }, [step, data]);

  const canAdvance = Object.keys(stepErrors).length === 0;

  const onNext = () => {
    setTouchedNext(true);
    if (!canAdvance) return;
    setTouchedNext(false);
    setStep((s) => Math.min(2, s + 1) as StepIndex);
  };

  const onBack = () => {
    setTouchedNext(false);
    if (step === 0) {
      // First form step — step back to the calculator.
      editSelection();
      return;
    }
    setStep((s) => Math.max(0, s - 1) as StepIndex);
  };

  const handleFilePick = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFiles: React.Dispatch<React.SetStateAction<File[]>>,
    allowed?: string[],
  ) => {
    const picked = Array.from(e.target.files ?? []);
    const filtered = picked.filter((f) => {
      if (f.size > MAX_FILE_SIZE) return false;
      if (allowed && allowed.length > 0) {
        const ext = f.name.toLowerCase().split(".").pop() ?? "";
        const byExt = ["png", "jpg", "jpeg", "pdf", "ai", "eps"].includes(ext);
        return allowed.includes(f.type) || byExt;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...filtered]);
    e.target.value = "";
  };

  const removeFile = (
    index: number,
    setFiles: React.Dispatch<React.SetStateAction<File[]>>,
  ) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const effectiveQuantity = data.sizesLater
        ? data.quantity
        : String(sumSizes(data.sizes));
      const payload: QuoteFormData = { ...data, quantity: effectiveQuantity };

      // Snapshot of the on-screen estimate so Julian sees exactly the price the
      // customer was shown, plus the inputs behind it ("why").
      const displayPerUnit = roundDisplayPrice(formPerUnit);
      const submitQty = Number(effectiveQuantity) || effectiveQty;
      const estimate = {
        available: Boolean(priced) && formPerUnit > 0,
        product: CALC_PRODUCTS.find((o) => o.value === calcProduct)?.label ?? "Custom",
        sku: priced ?? null,
        decoration: priced ? effDecoration : null,
        colors: isScreen ? colorCount : null,
        locations: priced ? formLocations : null,
        quantity: submitQty,
        perUnit: displayPerUnit,
        total: displayPerUnit * submitQty,
      };

      const body = new FormData();
      body.append("payload", JSON.stringify(payload));
      body.append("estimate", JSON.stringify(estimate));
      artworkFiles.forEach((f) => body.append("artwork", f));
      priceMatchFiles.forEach((f) => body.append("priceMatch", f));

      const res = await fetch("/api/submit", { method: "POST", body });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Something went wrong (${res.status}).`);
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-dream-cream">
      <div className="mx-auto max-w-[960px] px-6 py-14 lg:px-10 lg:py-20">
        <div
          id="quick-quote"
          ref={cardRef}
          className="rough-card relative w-full scroll-mt-28 px-5 py-6 sm:px-10 sm:py-10"
        >
          {submitted ? (
            <SuccessCard />
          ) : phase === "calc" ? (
            <Calculator
              calcProduct={calcProduct}
              setCalcProduct={setCalcProduct}
              quantity={quantity}
              setQuantity={setQuantity}
              useCustomQty={useCustomQty}
              setUseCustomQty={setUseCustomQty}
              printColors={printColors}
              setPrintColors={setPrintColors}
              decoration={effDecoration}
              setDecoration={setDecoration}
              availableDecos={availableDecos}
              locations={locations}
              setLocations={setLocations}
              isScreen={isScreen}
              colorCount={colorCount}
              perUnit={perUnit}
              qtyNum={qtyNum}
              isContact={calcProduct === "other"}
              onLockIn={lockIn}
            />
          ) : (
            <div className="mx-auto max-w-xl">
              <ProgressBar step={step} total={FORM_STEPS.length} />

              <div className="mt-5">
                <h2 className="font-display text-2xl font-bold leading-tight text-dream-ink sm:text-3xl">
                  {FORM_STEPS[step].title}
                </h2>
                <p className="mt-1 text-sm text-dream-ink-soft">{FORM_STEPS[step].subtitle}</p>
              </div>

              <div className="mt-6">
                {step === 0 && (
                  <div className="space-y-7">
                    <StepProduct
                      data={data}
                      update={update}
                      errors={touchedNext ? stepErrors : {}}
                      showProductGrid={!productLocked}
                    />
                    <StepPrint
                      data={data}
                      update={update}
                      toggleLocation={toggleLocation}
                      errors={touchedNext ? stepErrors : {}}
                      showColors={!productLocked}
                    />
                  </div>
                )}
                {step === 1 && (
                  <StepArtwork
                    data={data}
                    update={update}
                    files={artworkFiles}
                    onPick={() => artworkInputRef.current?.click()}
                    onRemove={(i) => removeFile(i, setArtworkFiles)}
                    inputRef={artworkInputRef}
                    onChange={(e) => handleFilePick(e, setArtworkFiles, ALLOWED_ARTWORK)}
                  />
                )}
                {step === 2 && (
                  <div className="space-y-8">
                    <StepContact
                      data={data}
                      update={update}
                      errors={touchedNext ? stepErrors : {}}
                    />
                    <StepTimeline
                      data={data}
                      update={update}
                      files={priceMatchFiles}
                      onPick={() => priceMatchInputRef.current?.click()}
                      onRemove={(i) => removeFile(i, setPriceMatchFiles)}
                      inputRef={priceMatchInputRef}
                      onChange={(e) => handleFilePick(e, setPriceMatchFiles)}
                    />
                  </div>
                )}
              </div>

              {submitError && (
                <div className="mt-4 rounded-xl border border-red-400/60 bg-red-100/70 px-4 py-3 text-sm text-red-900">
                  {submitError}
                </div>
              )}

              <p className="mt-6 text-center text-xs text-dream-ink-soft">
                Have a quote from{" "}
                <span className="font-semibold text-dream-ink">Get Bold</span> or{" "}
                <span className="font-semibold text-dream-ink">Coastal Reign</span>?
                Add it on the last step for Julian&apos;s price match.
              </p>

              {/* Sticky action bar — keeps the locked-in price and the primary
                  CTA glued to the bottom of the screen through every step.
                  Opaque yellow bg so it cleanly covers fields it floats over. */}
              <div className="sticky bottom-4 z-20 mt-8 rounded-full border-2 border-dream-ink/20 bg-dream-sun px-5 py-3 shadow-[0_4px_0_0_rgba(27,20,88,0.9)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {formPerUnit > 0 ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dream-ink/60">
                          est.
                        </span>
                        <AnimatedPrice
                          value={formPerUnit}
                          className="font-display text-2xl font-bold leading-none text-dream-ink tabular-nums sm:text-3xl"
                        />
                        <span className="text-xs font-semibold text-dream-ink/70">/ item</span>
                      </div>
                    ) : (
                      <span className="font-display text-base font-bold text-dream-ink">
                        Custom quote
                      </span>
                    )}
                    <div className="mt-0.5 truncate text-[11px] font-semibold text-dream-ink/65">
                      {formPerUnit > 0 && effectiveQty > 0
                        ? `≈ $${(roundDisplayPrice(formPerUnit) * effectiveQty).toLocaleString()} total · `
                        : ""}
                      {effectiveQty} {CALC_PRODUCTS.find((o) => o.value === calcProduct)?.label ?? "items"}
                      {priced ? ` · ${effDecoration === "embroidery" ? "embroidery" : "screen print"}` : ""}
                      {isScreen && colorCount > 0
                        ? ` · ${colorCount} ${colorCount === 1 ? "color" : "colors"}`
                        : ""}
                      {priced && formLocations > 1 ? ` · ${formLocations} locations` : ""}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={onBack}
                      disabled={submitting}
                      className="h-12 rounded-xl border-2 border-dream-ink/70 bg-transparent px-4 font-display text-base font-semibold text-dream-ink transition active:scale-[0.98] disabled:opacity-50"
                    >
                      Back
                    </button>
                    {step < 2 ? (
                      <button
                        type="button"
                        onClick={onNext}
                        className="h-12 rounded-xl border-2 border-dream-ink bg-white px-6 font-display text-lg font-bold text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)]"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitting}
                        className="h-12 rounded-xl border-2 border-dream-ink bg-white px-6 font-display text-lg font-bold text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)] disabled:opacity-60"
                      >
                        {submitting ? "Sending…" : "Submit :)"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Calculator phase ---------- */

function Calculator({
  calcProduct,
  setCalcProduct,
  quantity,
  setQuantity,
  useCustomQty,
  setUseCustomQty,
  printColors,
  setPrintColors,
  decoration,
  setDecoration,
  availableDecos,
  locations,
  setLocations,
  isScreen,
  colorCount,
  perUnit,
  qtyNum,
  isContact,
  onLockIn,
}: {
  calcProduct: CalcProduct;
  setCalcProduct: (p: CalcProduct) => void;
  quantity: string;
  setQuantity: (q: string) => void;
  useCustomQty: boolean;
  setUseCustomQty: (b: boolean) => void;
  printColors: string;
  setPrintColors: (c: string) => void;
  decoration: Decoration;
  setDecoration: (d: Decoration) => void;
  availableDecos: Decoration[];
  locations: number;
  setLocations: (n: number) => void;
  isScreen: boolean;
  colorCount: number;
  perUnit: number;
  qtyNum: number;
  isContact: boolean;
  onLockIn: () => void;
}) {
  const DECORATION_LABEL: Record<Decoration, string> = {
    screen: "Screen print",
    embroidery: "Embroidery",
  };
  const locationWord = decoration === "embroidery" ? "Embroidery" : "Print";
  return (
    <>
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-4xl">
          Get A Quick Quote
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-dream-ink/65 sm:text-[15px]">
          Pick your product, colors and quantity. Your estimate updates as you go.
        </p>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-center md:gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <div className="flex flex-col gap-5">
          <PillField label="Product Type">
            {CALC_PRODUCTS.map((opt) => (
              <PillButton
                key={opt.value}
                active={calcProduct === opt.value}
                onClick={() => setCalcProduct(opt.value)}
              >
                {opt.label}
              </PillButton>
            ))}
          </PillField>

          {!isContact && availableDecos.length > 1 && (
            <PillField label="Decoration">
              {availableDecos.map((d) => (
                <PillButton
                  key={d}
                  active={decoration === d}
                  onClick={() => setDecoration(d)}
                >
                  {DECORATION_LABEL[d]}
                </PillButton>
              ))}
            </PillField>
          )}

          {isScreen && (
            <PillField label="Print colors">
              {["1", "2", "3", "4", "5+"].map((n) => {
                const value = n === "5+" ? "5" : n;
                return (
                  <PillButton
                    key={n}
                    active={printColors === value}
                    onClick={() => setPrintColors(value)}
                  >
                    {n}
                  </PillButton>
                );
              })}
            </PillField>
          )}

          {!isContact && (
            <PillField label={`${locationWord} locations`}>
              {Array.from({ length: MAX_LOCATIONS }, (_, i) => i + 1).map((n) => (
                <PillButton
                  key={n}
                  active={locations === n}
                  onClick={() => setLocations(n)}
                >
                  {n}
                </PillButton>
              ))}
            </PillField>
          )}

          <div>
            <div className="mb-1.5 font-display text-[13px] font-bold text-dream-ink">
              Quantity
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUANTITY_PRESETS.map((n) => (
                <PillButton
                  key={n}
                  active={!useCustomQty && quantity === String(n)}
                  onClick={() => {
                    setUseCustomQty(false);
                    setQuantity(String(n));
                  }}
                >
                  {n}
                </PillButton>
              ))}
              <PillButton active={useCustomQty} onClick={() => setUseCustomQty(true)}>
                Custom
              </PillButton>
            </div>
            {useCustomQty && (
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="How many?"
                autoFocus
                className="mt-2 w-32 rounded-lg border border-dream-ink/12 bg-white px-4 py-2.5 text-sm text-dream-ink placeholder:text-dream-ink/35 focus:border-dream-purple focus:outline-none"
              />
            )}
          </div>

          <PriceCard
            perUnit={perUnit}
            quantity={qtyNum}
            isContact={isContact}
            onLockIn={onLockIn}
          />
        </div>

        <HoodieDiagram colorCount={colorCount} />
      </div>
    </>
  );
}

function PillField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-display text-[13px] font-bold text-dream-ink">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function parseColorCount(value: string): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(DREAM_LETTERS.length, n));
}

function HoodieDiagram({ colorCount }: { colorCount: number }) {
  return (
    <div className="relative hidden md:flex md:items-center md:justify-center">
      <div className="relative aspect-square w-full">
        <Image
          src="/getaquickquote/hoodie.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 320px, (min-width: 768px) 280px, 0px"
          className="object-contain"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 top-[48%] flex -translate-y-1/2 justify-center">
          <span className="font-display text-[30px] font-bold tracking-[0.04em]">
            {DREAM_LETTERS.map((letter, i) => (
              <span
                key={i}
                style={{
                  color: i < colorCount ? LETTER_COLORS[i] : DEFAULT_LETTER,
                  transition: "color 180ms ease",
                }}
              >
                {letter}
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

function PriceCard({
  perUnit,
  quantity,
  isContact,
  onLockIn,
}: {
  perUnit: number;
  quantity: number;
  isContact: boolean;
  onLockIn: () => void;
}) {
  if (isContact) {
    return (
      <div className="mt-1 rounded-2xl bg-dream-sun px-6 py-5 text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)]">
        <div className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-dream-ink/65">
          Custom item
        </div>
        <div className="mt-2 text-sm leading-relaxed text-dream-ink/70">
          Tell us what you have in mind and we&apos;ll put together a quote.
        </div>
        <button
          type="button"
          onClick={onLockIn}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-dream-ink px-6 py-3.5 font-display text-base font-bold text-white shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)] sm:w-auto"
        >
          Contact for quote
        </button>
      </div>
    );
  }

  const hasQty = quantity > 0;
  return (
    <div className="mt-1 rounded-2xl bg-dream-sun px-6 py-5 text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)]">
      <div className="flex items-center justify-between">
        <span className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-dream-ink/65">
          Estimated price
        </span>
        <span className="text-[11px] text-dream-ink/55">Final quote may vary</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-display text-5xl font-bold leading-none text-black sm:text-6xl tabular-nums">
          {hasQty ? <AnimatedPrice value={perUnit} /> : "—"}
        </div>
        <div className="font-display text-base font-semibold text-dream-ink/70">
          {hasQty ? "/ item" : ""}
        </div>
      </div>
      {hasQty && (
        <div className="mt-1.5 text-sm font-semibold text-dream-ink/70 tabular-nums">
          ≈ ${(roundDisplayPrice(perUnit) * quantity).toLocaleString()} total
          <span className="font-normal text-dream-ink/50"> for {quantity} pieces</span>
        </div>
      )}
      {!hasQty && (
        <div className="mt-2 text-xs text-dream-ink/55">Enter a quantity to see your price</div>
      )}
      {hasQty && (
        <button
          type="button"
          onClick={onLockIn}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-dream-ink px-6 py-3.5 font-display text-base font-bold text-white shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)] sm:w-auto"
        >
          Lock in this price
        </button>
      )}
    </div>
  );
}

/* ---------- Form phase: shared bits ---------- */

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-dream-ink-soft">
        <span>
          Step {step + 1} of {total}
        </span>
        <span>{Math.round(((step + 1) / total) * 100)}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/50">
        <div
          className="h-full rounded-full bg-dream-purple transition-all duration-300 ease-out"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SuccessCard() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-2 py-10 text-center">
      <Image
        src="/dreamhouse-logo.svg"
        alt="Dreamhouse Printing"
        width={88}
        height={80}
        priority
      />
      <h2 className="mt-6 font-display text-3xl font-bold text-dream-ink sm:text-4xl">
        Got it! :)
      </h2>
      <p className="mt-4 text-lg text-dream-ink-soft">
        Julian will get back to you within{" "}
        <span className="font-semibold text-dream-ink">24 hours</span> with your quote.
      </p>
    </div>
  );
}

/* ---------- Form fields ---------- */

function Field({
  label,
  children,
  error,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-sm font-semibold text-dream-ink">{label}</span>
      {children}
      {error && (
        <span className="mt-1 block text-xs font-medium text-red-700">{error}</span>
      )}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border-2 border-dream-ink/80 bg-white px-4 py-3.5 text-base text-dream-ink placeholder:text-dream-ink/40 outline-none transition focus:border-dream-purple focus:ring-4 focus:ring-dream-purple/20";

function StepProduct({
  data,
  update,
  errors,
  showProductGrid,
}: {
  data: QuoteFormData;
  update: <K extends keyof QuoteFormData>(k: K, v: QuoteFormData[K]) => void;
  errors: Record<string, string>;
  showProductGrid: boolean;
}) {
  const sizeTotal = sumSizes(data.sizes);
  const setSize = (key: SizeKey, value: string) => {
    const clean = value.replace(/[^\d]/g, "");
    const next: SizeBreakdown = { ...data.sizes };
    if (clean === "" || clean === "0") delete next[key];
    else next[key] = clean;
    update("sizes", next);
  };

  return (
    <div className="space-y-5">
      {showProductGrid && (
        <Field label="What are you printing on?" error={errors.productType}>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_GRID.map((opt) => {
              const selected = data.productType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("productType", opt.value)}
                  className={`rounded-2xl border-2 px-4 py-3 text-left font-display text-base font-semibold transition ${
                    selected
                      ? "border-dream-ink bg-dream-purple text-white shadow-[0_3px_0_0_rgba(27,20,88,0.9)]"
                      : "border-dream-ink/80 bg-white text-dream-ink hover:bg-dream-cream"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      <Field label="Garment color" error={errors.garmentColor} htmlFor="color">
        <input
          id="color"
          type="text"
          value={data.garmentColor}
          onChange={(e) => update("garmentColor", e.target.value)}
          placeholder="e.g. Heather grey, black, white"
          className={inputCls}
        />
      </Field>

      {data.sizesLater ? (
        <Field label="Total quantity" error={errors.quantity} htmlFor="qty">
          <input
            id="qty"
            type="number"
            inputMode="numeric"
            min={1}
            value={data.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            placeholder="How many pieces total?"
            className={inputCls}
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-dream-ink-soft">Minimum order is 12 pieces.</span>
            <button
              type="button"
              onClick={() => update("sizesLater", false)}
              className="font-semibold text-dream-purple underline-offset-2 hover:underline"
            >
              Add size breakdown
            </button>
          </div>
        </Field>
      ) : (
        <Field label="Size breakdown" error={errors.sizes}>
          <div className="grid grid-cols-3 gap-2">
            {SIZE_KEYS.map((k) => {
              const v = data.sizes[k] ?? "";
              const active = v !== "" && Number(v) > 0;
              return (
                <label
                  key={k}
                  className={`flex items-center gap-2 rounded-2xl border-2 bg-white px-3 py-2.5 transition ${
                    active
                      ? "border-dream-ink shadow-[0_3px_0_0_rgba(27,20,88,0.9)]"
                      : "border-dream-ink/60"
                  }`}
                >
                  <span className="font-display text-sm font-bold text-dream-ink">{k}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={v}
                    onChange={(e) => setSize(k, e.target.value)}
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent text-right text-base font-semibold text-dream-ink outline-none placeholder:text-dream-ink/30"
                  />
                </label>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-dream-ink">
              Total:{" "}
              <span className="text-dream-purple">
                {sizeTotal} {sizeTotal === 1 ? "piece" : "pieces"}
              </span>
              {sizeTotal > 0 && sizeTotal < 12 && (
                <span className="ml-1 font-normal text-dream-ink-soft">(min 12)</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => update("sizesLater", true)}
              className="font-semibold text-dream-purple underline-offset-2 hover:underline"
            >
              I&rsquo;ll give sizes later
            </button>
          </div>
        </Field>
      )}
    </div>
  );
}

// Product options for the in-form grid (only shown for "Other" / unpriced).
const PRODUCT_GRID: { value: ProductType; label: string }[] = [
  { value: "t-shirts", label: "T-shirts" },
  { value: "hoodies", label: "Hoodies" },
  { value: "crewnecks", label: "Crewnecks" },
  { value: "hats", label: "Hats" },
  { value: "tote-bags", label: "Tote bags" },
  { value: "other", label: "Other" },
];

function StepPrint({
  data,
  update,
  toggleLocation,
  errors,
  showColors,
}: {
  data: QuoteFormData;
  update: <K extends keyof QuoteFormData>(k: K, v: QuoteFormData[K]) => void;
  toggleLocation: (loc: PrintLocation) => void;
  errors: Record<string, string>;
  showColors: boolean;
}) {
  return (
    <div className="space-y-5">
      {showColors && (
        <Field label="Number of print colors" error={errors.printColors}>
          <div className="flex gap-2">
            {PRINT_COLOR_OPTIONS.map((opt) => {
              const selected = data.printColors === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => update("printColors", opt)}
                  className={`flex-1 rounded-2xl border-2 py-3 font-display text-lg font-bold transition ${
                    selected
                      ? "border-dream-ink bg-dream-purple text-white shadow-[0_3px_0_0_rgba(27,20,88,0.9)]"
                      : "border-dream-ink/80 bg-white text-dream-ink hover:bg-dream-cream"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      <Field label="Print locations" error={errors.printLocations}>
        <div className="grid grid-cols-2 gap-2">
          {PRINT_LOCATIONS.map((loc) => {
            const selected = data.printLocations.includes(loc.value);
            return (
              <button
                key={loc.value}
                type="button"
                onClick={() => toggleLocation(loc.value)}
                className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-3 text-left font-medium transition ${
                  selected
                    ? "border-dream-ink bg-dream-purple text-white shadow-[0_3px_0_0_rgba(27,20,88,0.9)]"
                    : "border-dream-ink/80 bg-white text-dream-ink hover:bg-dream-cream"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                    selected
                      ? "border-white bg-white text-dream-purple"
                      : "border-dream-ink/70 bg-transparent"
                  }`}
                >
                  {selected && (
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
                      <path d="M7.7 13.3 4.4 10l-1.4 1.4 4.7 4.7 10-10-1.4-1.4z" />
                    </svg>
                  )}
                </span>
                <span className="text-sm">{loc.label}</span>
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function StepArtwork({
  data,
  update,
  files,
  onPick,
  onRemove,
  inputRef,
  onChange,
}: {
  data: QuoteFormData;
  update: <K extends keyof QuoteFormData>(k: K, v: QuoteFormData[K]) => void;
  files: File[];
  onPick: () => void;
  onRemove: (i: number) => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-dream-ink">
          Upload your artwork
        </span>
        <button
          type="button"
          onClick={onPick}
          className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-dream-ink/80 bg-white/80 px-4 py-6 text-left transition hover:bg-white"
        >
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dream-ink bg-dream-purple text-white shadow-[0_3px_0_0_rgba(27,20,88,0.9)]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v14" />
              <path d="m6 9 6-6 6 6" />
              <path d="M5 21h14" />
            </svg>
          </div>
          <div>
            <p className="font-display text-lg font-bold text-dream-ink">Upload Files Here</p>
            <p className="text-xs text-dream-ink-soft">
              Artwork, mockups, logos — PNG, JPG, PDF, AI, EPS (max 25MB each)
            </p>
          </div>
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".png,.jpg,.jpeg,.pdf,.ai,.eps,image/*,application/pdf,application/postscript"
          onChange={onChange}
        />

        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-dream-ink/40 bg-white/80 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-dream-ink">{f.name}</p>
                  <p className="text-xs text-dream-ink-soft">{(f.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="text-xs font-semibold text-red-700 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field label="Describe your design (if you don't have artwork yet)" htmlFor="desc">
        <textarea
          id="desc"
          rows={4}
          value={data.designDescription}
          onChange={(e) => update("designDescription", e.target.value)}
          placeholder="e.g. Our band logo across the front, small text on the sleeve…"
          className={`${inputCls} resize-none`}
        />
      </Field>
    </div>
  );
}

function StepContact({
  data,
  update,
  errors,
}: {
  data: QuoteFormData;
  update: <K extends keyof QuoteFormData>(k: K, v: QuoteFormData[K]) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <Field label="Name" error={errors.name} htmlFor="name">
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Your full name"
          className={inputCls}
        />
      </Field>

      <Field label="Email" error={errors.email} htmlFor="email">
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={data.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="you@email.com"
          className={inputCls}
        />
      </Field>

      <Field label="Phone" error={errors.phone} htmlFor="phone">
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={data.phone}
          onChange={(e) => update("phone", formatPhone(e.target.value))}
          placeholder="555-123-4567"
          className={inputCls}
        />
      </Field>

      <Field label="Referral or promo code (optional)" htmlFor="referral">
        <input
          id="referral"
          type="text"
          value={data.referralCode}
          onChange={(e) => update("referralCode", e.target.value)}
          placeholder="Who sent you?"
          className={inputCls}
        />
      </Field>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-dream-ink">
          How did you find us? (optional)
        </span>
        <div className="grid grid-cols-2 gap-2">
          {HEARD_ABOUT_OPTIONS.map((opt) => {
            const selected = data.heardAbout === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => update("heardAbout", selected ? "" : opt)}
                className={`rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition ${
                  selected
                    ? "border-dream-ink bg-dream-purple text-white shadow-[0_3px_0_0_rgba(27,20,88,0.9)]"
                    : "border-dream-ink/80 bg-white text-dream-ink hover:bg-dream-cream"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepTimeline({
  data,
  update,
  files,
  onPick,
  onRemove,
  inputRef,
  onChange,
}: {
  data: QuoteFormData;
  update: <K extends keyof QuoteFormData>(k: K, v: QuoteFormData[K]) => void;
  files: File[];
  onPick: () => void;
  onRemove: (i: number) => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  // Single fixed reference date avoids new Date() churn on every render and is
  // fine as a min for the date picker.
  const today = todayISO();
  const [priceMatchMode, setPriceMatchMode] = useState<"link" | "file">(
    data.priceMatchLink ? "link" : files.length > 0 ? "file" : "link",
  );

  return (
    <div className="space-y-5">
      <Field label="When do you need this by?" htmlFor="needed">
        <input
          id="needed"
          type="date"
          min={today}
          value={data.neededBy}
          onChange={(e) => update("neededBy", e.target.value)}
          className={inputCls}
        />
      </Field>

      <Field label="Anything else? (optional)" htmlFor="notes">
        <textarea
          id="notes"
          rows={4}
          value={data.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Special requests, packaging, anything Julian should know…"
          className={`${inputCls} resize-none`}
        />
      </Field>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-dream-ink">
          Have a quote from another printer?
        </span>
        <p className="mb-3 text-xs text-dream-ink-soft">
          Share it here and Julian will try to beat it (Get Bold, Coastal Reign, etc.)
        </p>

        <div className="mb-3 flex gap-2 rounded-2xl border-2 border-dream-ink/20 bg-white/60 p-1">
          {(["link", "file"] as const).map((mode) => {
            const active = priceMatchMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setPriceMatchMode(mode)}
                className={`flex-1 rounded-xl px-3 py-2 font-display text-sm font-semibold transition ${
                  active
                    ? "bg-dream-purple text-white shadow-[0_2px_0_0_rgba(27,20,88,0.9)]"
                    : "text-dream-ink/70 hover:text-dream-ink"
                }`}
              >
                {mode === "link" ? "Paste link" : "Upload file"}
              </button>
            );
          })}
        </div>

        {priceMatchMode === "link" ? (
          <input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={data.priceMatchLink}
            onChange={(e) => update("priceMatchLink", e.target.value)}
            placeholder="https://…"
            className={inputCls}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={onPick}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-dream-ink/60 bg-white/70 px-4 py-4 text-left transition hover:bg-white"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dream-ink bg-dream-purple text-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-dream-ink">Upload price match file</p>
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,application/pdf"
              onChange={onChange}
            />

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-dream-ink/40 bg-white/80 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-dream-ink">{f.name}</p>
                      <p className="text-xs text-dream-ink-soft">{(f.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[44px] rounded-full px-4 py-2 font-display text-[13px] font-semibold transition ${
        active
          ? "bg-dream-purple text-white"
          : "border border-dream-ink/15 bg-white text-dream-ink hover:border-dream-ink/40"
      }`}
    >
      {children}
    </button>
  );
}
