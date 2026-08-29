"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  HEARD_ABOUT_OPTIONS,
  PRINT_COLOR_CHOICES,
  PRINT_LOCATIONS,
  SIZE_KEYS,
  defaultPrints,
  emptyFormData,
  nextPrint,
  printColorLabel,
  printLocationLabel,
  sumSizes,
  type PrintLocation,
  type PrintMethod,
  type PrintSpec,
  type ProductType,
  type QuoteFormData,
  type SizeBreakdown,
  type SizeKey,
} from "@/lib/formTypes";
import {
  AVAILABLE_DECORATIONS,
  calculateQuoteForPrints,
  DECORATION,
  roundDisplayPrice,
  type Decoration,
  type PricedProduct,
  type PrintPriceLine,
} from "@/lib/pricing";
import AnimatedPrice from "./AnimatedPrice";

// ─────────────────────────────────────────────────────────────────────────────
// The home page's all-in-one quote card. It starts as the price calculator
// (phase "calc"); locking in a price swaps the same card into the multi-step
// request form (phase "form"), carrying the calculator's picks across. There's
// no separate /quote page, this card owns the whole flow.
// ─────────────────────────────────────────────────────────────────────────────

const DREAM_LETTERS = ["D", "R", "E", "A", "M"] as const;
const LETTER_COLORS = ["#7664ff", "#ec3f9e", "#16b6a8", "#ecbb25", "#ff8a52"];
const DEFAULT_LETTER = "#2a1b8a";

// Products the calculator can price. The two headwear SKUs are separate because
// their prices differ materially (a dad cap runs ~$5/unit over a toque). "other"
// has no price data, it routes straight into the form for a manual quote.
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
  hat: "dad-cap",
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

const STORAGE_BUCKET = "quote-files";

type UploadedRef = { name: string; path: string };

// Upload artwork + price-match files directly to Supabase Storage using
// server-minted signed upload URLs, then return their {name, path} so the
// submit call only carries small JSON. This sidesteps Vercel's 4.5MB
// serverless request-body limit, which 413'd any sizeable artwork uploaded
// through /api/submit. Throws on failure so the caller can surface an error.
async function uploadAttachments(
  artworkFiles: File[],
  priceMatchFiles: File[],
): Promise<{ artwork: UploadedRef[]; priceMatch: UploadedRef[] }> {
  const all = [
    ...artworkFiles.map((file, i) => ({ id: `a${i}`, kind: "artwork", file })),
    ...priceMatchFiles.map((file, i) => ({ id: `p${i}`, kind: "price-match", file })),
  ];
  if (all.length === 0) return { artwork: [], priceMatch: [] };

  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      files: all.map(({ id, kind, file }) => ({
        id,
        kind,
        name: file.name,
        size: file.size,
      })),
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Couldn't prepare your files for upload.");
  }
  const data = (await res.json()) as {
    configured?: boolean;
    uploads?: { id: string; kind: string; path: string; token: string }[];
  };
  // Storage not configured (local dev without creds), submit without files,
  // matching the app's graceful-degradation behavior.
  if (!data.configured) return { artwork: [], priceMatch: [] };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Uploads are temporarily unavailable. Please try again later.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const byId = new Map(all.map((x) => [x.id, x.file]));
  const artwork: UploadedRef[] = [];
  const priceMatch: UploadedRef[] = [];

  for (const up of data.uploads ?? []) {
    const file = byId.get(up.id);
    if (!file) continue;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .uploadToSignedUrl(up.path, up.token, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      console.error("[upload] failed", up.path, error);
      throw new Error(`Couldn't upload "${file.name}". Please try again.`);
    }
    const ref: UploadedRef = { name: file.name, path: up.path };
    if (up.kind === "price-match") priceMatch.push(ref);
    else artwork.push(ref);
  }

  return { artwork, priceMatch };
}

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
  { title: "Upload your artwork", subtitle: "PNG, JPG, PDF, AI or EPS, whatever you've got." },
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
  const [decoration, setDecoration] = useState<Decoration>("screen");
  // The explicit list of prints (location + that print's own colour count).
  // One piece of state shared by both phases: the calculator and the form step
  // edit the same list, so the price never disagrees with what's on screen.
  const [prints, setPrints] = useState<PrintSpec[]>(defaultPrints);

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

  // Preselect the product from a ?product= hint. Two cases:
  //  1. Landing here from another page (services, etc.), read it on mount.
  //  2. Clicking a category link while ALREADY on the home page, Next does a
  //     client-side nav that doesn't remount this card, so we also intercept
  //     clicks on any in-page link carrying ?product= and switch to it. This
  //     stays self-contained here instead of touching every link site.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const selectFrom = (search: string) => {
      const p = new URLSearchParams(search).get("product");
      if (p && PRODUCT_PARAM[p]) {
        setCalcProduct(PRODUCT_PARAM[p]);
        setPhase("calc"); // back out of the form if they re-pick a category
      }
    };

    selectFrom(window.location.search);

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.pathname === "/" && url.searchParams.has("product")) {
        selectFrom(url.search);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
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
  // The hoodie diagram tints one letter per colour, so it follows the busiest
  // print in the list.
  const colorCount = prints.reduce((max, p) => Math.max(max, p.colors), 0);
  const qtyNum = Math.max(0, parseInt(quantity, 10) || 0);
  const quote = priced
    ? calculateQuoteForPrints(priced, qtyNum, prints, effDecoration)
    : null;
  const perUnit = quote?.available ? quote.perUnit : 0;
  const calcLines = quote?.available ? quote.lines : [];

  // "other" isn't a real SKU, so the form keeps the product picker; priced
  // products lock it (it's shown in the summary banner instead).
  const productLocked = calcProduct !== "other";

  // In the form phase the quantity is still editable (Total quantity field /
  // size breakdown), so the summary + sticky bar track the live effective
  // quantity, falling back to the locked-in qty while the field is empty.
  const formQty = data.sizesLater
    ? Math.max(0, parseInt(data.quantity, 10) || 0)
    : sumSizes(data.sizes);
  const effectiveQty = formQty > 0 ? formQty : qtyNum;
  // The form edits the same prints list, so its price is the same calculation
  // against the live quantity.
  const formQuote = priced
    ? calculateQuoteForPrints(priced, effectiveQty, prints, effDecoration)
    : null;
  const formPerUnit = formQuote?.available ? formQuote.perUnit : 0;
  const formLines = formQuote?.available ? formQuote.lines : [];

  const update = <K extends keyof QuoteFormData>(key: K, value: QuoteFormData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const lockIn = () => {
    const mapped = TO_FORM[calcProduct];
    // Carry the chosen decoration into the form's print method (priced products
    // only; "other" keeps the form's "not-sure" default).
    const printMethod: PrintMethod = priced ? effDecoration : mapped.printMethod;
    setData((d) => ({
      ...d,
      productType: mapped.productType,
      printMethod,
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
      if (prints.length === 0) errs.prints = "Add at least one print.";
    }
    if (step === 2) {
      if (!data.name.trim()) errs.name = "We need a name to put on your quote.";
      if (!data.email.trim()) errs.email = "Email is required so Julian can reply.";
      else if (!isValidEmail(data.email)) errs.email = "That email doesn't look right.";
      if (!data.phone.trim()) errs.phone = "Phone is required.";
    }
    return errs;
  }, [step, data, prints]);

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
      // First form step, step back to the calculator.
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
    // Final step still runs the step-2 checks (contact fields + needed-by date)
    // so a past date or a missing field is caught before we hit the server.
    setTouchedNext(true);
    if (!canAdvance) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const effectiveQuantity = data.sizesLater
        ? data.quantity
        : String(sumSizes(data.sizes));
      // The prints list lives outside `data` (both phases edit it), so fold it
      // into the payload here. The API derives print_locations + print_colors
      // from it.
      const payload: QuoteFormData = {
        ...data,
        quantity: effectiveQuantity,
        prints,
      };

      // Snapshot of the on-screen estimate so Julian sees exactly the price the
      // customer was shown, plus the inputs behind it ("why"), now including
      // the per-print breakdown.
      const displayPerUnit = roundDisplayPrice(formPerUnit);
      const submitQty = Number(effectiveQuantity) || effectiveQty;
      const estimate = {
        available: Boolean(priced) && formPerUnit > 0,
        product: CALC_PRODUCTS.find((o) => o.value === calcProduct)?.label ?? "Custom",
        sku: priced ?? null,
        decoration: priced ? effDecoration : null,
        colors: isScreen && prints.length > 0 ? prints[0].colors : null,
        locations: priced ? prints.length : null,
        quantity: submitQty,
        perUnit: displayPerUnit,
        perUnitExact: Number(formPerUnit.toFixed(2)),
        prints: formLines.map((line) => ({
          location: line.location,
          label: printLocationLabel(line.location),
          colors: line.colors,
          perUnit: Number(line.perUnit.toFixed(2)),
          base: Number(line.base.toFixed(2)),
          locationSurcharge: Number(line.locationSurcharge.toFixed(2)),
          colourSurcharge: Number(line.colourSurcharge.toFixed(2)),
        })),
        total: displayPerUnit * submitQty,
      };

      // Push files straight to Supabase Storage first (bypasses Vercel's
      // 4.5MB body cap, which 413'd large artwork). The submit body is then
      // just small JSON: the form data plus the uploaded file paths.
      const { artwork, priceMatch } = await uploadAttachments(
        artworkFiles,
        priceMatchFiles,
      );

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload, estimate, artwork, priceMatch }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Something went wrong (${res.status}).`);
      }
      setSubmitted(true);

      // Fire a GA4 event on successful submit. Mark this as a Key Event in the
      // GA4 dashboard (Admin > Events) to count it as a conversion.
      const gtag = (window as unknown as {
        gtag?: (...args: unknown[]) => void;
      }).gtag;
      gtag?.("event", "qualify_lead", {
        currency: "CAD",
        value: estimate.available ? estimate.total : 0,
        product: estimate.product,
        quantity: submitQty,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-dream-cream">
      {/* Slim outer gutter on phones so the card itself gets the width; the
          card keeps its own px-5 inside, so content never touches the edge. */}
      <div className="mx-auto max-w-[960px] px-3 py-14 sm:px-6 lg:max-w-[1080px] lg:px-10 lg:py-20">
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
              decoration={effDecoration}
              setDecoration={setDecoration}
              availableDecos={availableDecos}
              prints={prints}
              setPrints={setPrints}
              lines={calcLines}
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
                      prints={prints}
                      setPrints={setPrints}
                      lines={formLines}
                      decoration={data.printMethod === "embroidery" ? "embroidery" : "screen"}
                      productLabel={
                        CALC_PRODUCTS.find((o) => o.value === calcProduct)?.label ?? "Item"
                      }
                      errors={touchedNext ? stepErrors : {}}
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

              <p className="mt-6 text-center text-[14px] text-dream-ink-soft">
                Have a quote from{" "}
                <span className="font-semibold text-dream-ink">Get Bold</span> or{" "}
                <span className="font-semibold text-dream-ink">Coastal Reign</span>?
                Add it on the last step for Julian&apos;s price match.
              </p>

              {/* Sticky action bar, keeps the locked-in price and the primary
                  CTA glued to the bottom of the screen through every step.
                  Opaque yellow bg so it cleanly covers fields it floats over.
                  On phones the price and buttons stack (a single squeezed row
                  collided badly); from sm up they sit side by side as a pill. */}
              <div className="sticky bottom-4 z-20 mt-8 rounded-3xl border-2 border-dream-ink/20 bg-dream-sun px-4 py-3 shadow-[0_4px_0_0_rgba(27,20,88,0.9)] sm:rounded-full sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    {formPerUnit > 0 ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[14px] font-semibold uppercase tracking-[0.1em] text-dream-ink/60">
                          est.
                        </span>
                        <AnimatedPrice
                          value={formPerUnit}
                          className="font-display text-2xl font-bold leading-none text-dream-ink tabular-nums sm:text-3xl"
                        />
                        <span className="text-[14px] font-semibold text-dream-ink/70">/ item</span>
                      </div>
                    ) : (
                      <span className="font-display text-base font-bold text-dream-ink">
                        Custom quote
                      </span>
                    )}
                    <div className="mt-0.5 truncate text-[14px] font-semibold text-dream-ink/65">
                      {formPerUnit > 0 && effectiveQty > 0
                        ? `≈ $${(roundDisplayPrice(formPerUnit) * effectiveQty).toLocaleString()} total · `
                        : ""}
                      {effectiveQty} {CALC_PRODUCTS.find((o) => o.value === calcProduct)?.label ?? "items"}
                      {priced ? ` · ${effDecoration === "embroidery" ? "embroidery" : "screen print"}` : ""}
                      {priced && prints.length > 0
                        ? ` · ${prints.length} ${prints.length === 1 ? "print" : "prints"}`
                        : ""}
                      {isScreen && prints.length === 1
                        ? ` · ${printColorLabel(prints[0].colors)} ${
                            prints[0].colors === 1 ? "color" : "colors"
                          }`
                        : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onBack}
                      disabled={submitting}
                      className="h-12 flex-1 rounded-xl border-2 border-dream-ink/70 bg-transparent px-4 font-display text-base font-semibold text-dream-ink transition active:scale-[0.98] disabled:opacity-50 sm:flex-none"
                    >
                      Back
                    </button>
                    {step < 2 ? (
                      <button
                        type="button"
                        onClick={onNext}
                        className="h-12 flex-1 rounded-xl border-2 border-dream-ink bg-white px-6 font-display text-lg font-bold text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)] sm:flex-none"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitting}
                        className="h-12 flex-1 rounded-xl border-2 border-dream-ink bg-white px-6 font-display text-lg font-bold text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)] disabled:opacity-60 sm:flex-none"
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
  decoration,
  setDecoration,
  availableDecos,
  prints,
  setPrints,
  lines,
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
  decoration: Decoration;
  setDecoration: (d: Decoration) => void;
  availableDecos: Decoration[];
  prints: PrintSpec[];
  setPrints: (p: PrintSpec[]) => void;
  lines: PrintPriceLine[];
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
  const productLabel =
    CALC_PRODUCTS.find((o) => o.value === calcProduct)?.label ?? "Item";
  // Step numbers are assigned in render order and skip sections that don't
  // apply to this product ("Other" hides Decoration and Prints), so the
  // sequence the customer sees is always 1, 2, 3, … with no gaps.
  const showDecoration = !isContact && availableDecos.length > 1;
  const showPrints = !isContact;
  let stepNo = 0;
  const productStep = ++stepNo;
  const decorationStep = showDecoration ? ++stepNo : 0;
  const printsStep = showPrints ? ++stepNo : 0;
  const quantityStep = ++stepNo;
  return (
    <>
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-4xl">
          Get A Quick Quote
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-dream-ink/65 sm:text-[15px] lg:max-w-2xl">
          Pick your product, colors and quantity. Your estimate updates as you go.
        </p>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-center md:gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        {/* gap-8: each numbered step needs to read as its own block, at gap-5
            the whole calculator ran together as one dense list. */}
        <div className="flex flex-col gap-5 sm:gap-8">
          <PillField label="Product Type" step={productStep}>
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
            <PillField label="Decoration" step={decorationStep}>
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

          {!isContact && (
            <PrintsEditor
              prints={prints}
              setPrints={setPrints}
              lines={lines}
              decoration={decoration}
              productLabel={productLabel}
              step={printsStep}
            />
          )}

          <div>
            <div className="mb-3">
              <StepLabel n={quantityStep}>Quantity</StepLabel>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
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
              {/* Custom quantity stays in the same wrap group as the presets,
                  but is a rounded BOX, not a pill: "Custom" in a pill read as
                  one more thing to tap, so it wasn't obvious you type here.
                  Typing takes over from the pills; picking a pill again
                  clears it (value is only bound while useCustomQty is on). */}
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={useCustomQty ? quantity : ""}
                onChange={(e) => {
                  setUseCustomQty(true);
                  setQuantity(e.target.value);
                }}
                placeholder="e.g. 75"
                aria-label="Custom quantity"
                className={`w-[128px] rounded-lg border bg-white px-3.5 py-2 font-display text-[14px] font-semibold text-dream-ink transition placeholder:font-medium placeholder:text-dream-ink/50 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                  useCustomQty
                    ? "border-dream-purple ring-1 ring-dream-purple"
                    : "border-dream-ink/25 hover:border-dream-ink/45"
                }`}
              />
            </div>
          </div>

          <PriceCard
            perUnit={perUnit}
            quantity={qtyNum}
            printCount={prints.length}
            isContact={isContact}
            onLockIn={onLockIn}
          />
        </div>

        <HoodieDiagram colorCount={colorCount} />
      </div>
    </>
  );
}

/** Section label with a step number, so the calculator reads as a sequence.
 *  Numbers are passed in (not hardcoded) because Decoration and Prints only
 *  appear for some products, and the count has to stay unbroken. */
function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="font-display text-[14px] font-bold text-dream-ink">
      <span className="text-dream-ink/45">{n}.</span> {children}
    </span>
  );
}

function PillField({
  label,
  step,
  children,
}: {
  label: string;
  step?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3">
        {step ? (
          <StepLabel n={step}>{label}</StepLabel>
        ) : (
          <span className="font-display text-[14px] font-bold text-dream-ink">{label}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/* ---------- Prints editor (shared by the calculator and the form) ---------- */

// Builds the "how this adds up" line under one print row. The first print
// carries the garment + its decoration; every print after it adds the
// extra-location surcharge plus its own colour surcharge.
function printLineText(
  line: PrintPriceLine,
  productLabel: string,
  colourNoun: string,
): string {
  const bits: string[] = [
    line.base > 0 ? `${productLabel.toLowerCase()} + this print` : "extra location",
  ];
  if (line.colourSurcharge > 0)
    bits.push(`${colourNoun} +$${line.colourSurcharge.toFixed(2)}`);
  else if (line.colors > 1) bits.push(`${colourNoun} included`);
  const sign = line.base > 0 ? "" : "+ ";
  return `${sign}$${line.perUnit.toFixed(2)} / item (${bits.join(", ")})`;
}

function PrintsEditor({
  prints,
  setPrints,
  lines,
  decoration,
  productLabel,
  strong = false,
  error,
  step,
}: {
  prints: PrintSpec[];
  setPrints: (p: PrintSpec[]) => void;
  lines: PrintPriceLine[];
  decoration: Decoration;
  productLabel: string;
  strong?: boolean;
  error?: string;
  /** Step number shown beside the "Prints" heading in the calculator. */
  step?: number;
}) {
  const colourLabel = decoration === "embroidery" ? "Thread colors" : "Ink colors";
  const colourNoun = decoration === "embroidery" ? "thread colors" : "colors";
  const used = prints.map((p) => p.location);
  const canAdd = prints.length < PRINT_LOCATIONS.length;

  const setAt = (index: number, patch: Partial<PrintSpec>) =>
    setPrints(prints.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const removeAt = (index: number) =>
    setPrints(prints.filter((_, i) => i !== index));

  return (
    <div>
      {/* Hint always sits under the label: opposite ends of one line read as
          two unrelated bits of text rather than a heading and its caption. */}
      <div className="mb-3 flex flex-col gap-y-1">
        {step ? (
          <StepLabel n={step}>Prints</StepLabel>
        ) : (
          <span
            className={
              strong
                ? "text-sm font-semibold text-dream-ink"
                : "font-display text-[14px] font-bold text-dream-ink"
            }
          >
            Prints
          </span>
        )}
        <span className="text-[14px] text-dream-ink/70">
          One row per print, each with its own colors
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {prints.map((print, i) => {
          const line = lines[i];
          return (
            <div
              key={i}
              className={`rounded-2xl bg-white p-4 ${
                strong ? "border-[1.5px] border-dream-ink/80" : "border border-dream-ink/15"
              }`}
            >
              {/* Caption + full-width field, matching the "Ink colors" block
                  below. The old purple numbered circle read as a colour count:
                  it was the same pill as the 1-5+ chips a few lines down, so
                  two different meanings shared one visual. */}
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold text-dream-ink/55">
                  Print {i + 1}
                </span>
                {prints.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label={`Remove print ${i + 1}`}
                    className="text-[14px] font-semibold text-dream-ink/45 transition hover:text-dream-danger"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="mt-2">
                {/* globals.css sets appearance:none on every select (iOS), so
                    the native arrow is gone; overlay a chevron the way
                    components/ui/Select does or this reads as a plain pill. */}
                <div className="relative">
                  <select
                    value={print.location}
                    onChange={(e) =>
                      setAt(i, { location: e.target.value as PrintLocation })
                    }
                    aria-label={`Print ${i + 1} location`}
                    className="w-full appearance-none rounded-lg border border-dream-ink/20 bg-dream-cream py-2.5 pl-3 pr-9 font-display text-[14px] font-semibold text-dream-ink outline-none transition focus:border-dream-purple"
                  >
                    {PRINT_LOCATIONS.map((loc) => (
                      <option
                        key={loc.value}
                        value={loc.value}
                        disabled={loc.value !== print.location && used.includes(loc.value)}
                      >
                        {loc.label}
                      </option>
                    ))}
                  </select>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dream-ink/55"
                  >
                    <path
                      d="M6 8l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Label on its own line so the whole chip set stays together on
                  one row; inline, the label ate enough width to orphan "5+". */}
              <div className="mt-4">
                {/* Sentence case, no letter-spacing: matches the numbered step
                    labels above instead of shouting in stretched caps. */}
                <span className="block text-[14px] font-semibold text-dream-ink/55">
                  {colourLabel}
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {PRINT_COLOR_CHOICES.map((n) => (
                    <PillButton
                      key={n}
                      compact
                      active={print.colors === n}
                      onClick={() => setAt(i, { colors: n })}
                    >
                      {printColorLabel(n)}
                    </PillButton>
                  ))}
                </div>
              </div>

              {line && (
                <p className="mt-4 border-t border-dream-ink/10 pt-3 text-[14px] font-semibold text-dream-ink/60 tabular-nums">
                  {printLineText(line, productLabel, colourNoun)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setPrints([...prints, nextPrint(prints)])}
        disabled={!canAdd}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-dream-ink/40 bg-white px-4 py-2 font-display text-[14px] font-semibold text-dream-ink transition hover:border-dream-ink/70 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add another print
      </button>
      {!canAdd && (
        <span className="ml-2 text-[14px] text-dream-ink/50">
          That&apos;s every location we print.
        </span>
      )}
      {error && <span className="mt-1 block text-[14px] font-medium text-red-700">{error}</span>}
    </div>
  );
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
  printCount,
  isContact,
  onLockIn,
}: {
  perUnit: number;
  quantity: number;
  printCount: number;
  isContact: boolean;
  onLockIn: () => void;
}) {
  if (isContact) {
    return (
      <div className="mt-1 rounded-2xl bg-dream-sun px-5 py-4 sm:px-6 sm:py-5 text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)]">
        <div className="font-display text-[14px] font-bold text-dream-ink/70">
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
    <div className="mt-1 rounded-2xl bg-dream-sun px-5 py-4 sm:px-6 sm:py-5 text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)]">
      {/* Caption sits above the label, and both are sentence case with no
          letter-spacing: uppercase + 0.12em tracking made "Estimated price"
          wrap to two lines on a 375px phone. */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] text-dream-ink/55">Final quote may vary</span>
        <span className="font-display text-[15px] font-bold text-dream-ink/70">
          Estimated price
        </span>
      </div>
      {/* Price stack sits flush right on phones, where the card is full width
          and a left-aligned figure left a lot of dead space; desktop keeps the
          original left alignment. */}
      <div className="mt-5 flex items-baseline justify-end gap-2 sm:justify-start">
        <div className="font-display text-5xl font-bold leading-none text-black sm:text-6xl tabular-nums">
          {hasQty ? <AnimatedPrice value={perUnit} /> : "-"}
        </div>
        <div className="font-display text-base font-semibold text-dream-ink/70">
          {hasQty ? "/ item" : ""}
        </div>
      </div>
      {hasQty && (
        <div className="mt-1.5 text-right text-sm font-semibold text-dream-ink/70 tabular-nums sm:text-left">
          ≈ ${(roundDisplayPrice(perUnit) * quantity).toLocaleString()} total
          <span className="font-medium text-dream-ink/70"> for {quantity} pieces</span>
        </div>
      )}
      {hasQty && printCount > 0 && (
        <div className="mt-1 text-right text-[14px] font-medium text-dream-ink/55 tabular-nums sm:text-left">
          {printCount > 1 ? `${printCount} prints adding up to ` : ""}$
          {perUnit.toFixed(2)} / item before rounding
        </div>
      )}
      {!hasQty && (
        <div className="mt-2 text-[14px] text-dream-ink/55">Enter a quantity to see your price</div>
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
      <div className="flex items-center justify-between text-[14px] font-semibold uppercase tracking-wider text-dream-ink-soft">
        <span>
          Step {step + 1} of {total}
        </span>
        <span>{Math.round(((step + 1) / total) * 100)}%</span>
      </div>
      {/* The empty part of the track was white/50 on a near-white card, so the
          bar looked like it floated with no length to fill. */}
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-dream-lavender-soft">
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
        <span className="mt-1 block text-[14px] font-medium text-red-700">{error}</span>
      )}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border-[1.5px] border-dream-ink/80 bg-white px-4 py-3.5 text-base text-dream-ink placeholder:text-dream-ink/40 outline-none transition focus:border-dream-purple focus:ring-4 focus:ring-dream-purple/20";

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
          <div className="mt-2 flex items-center justify-between text-[14px]">
            <span className="text-dream-ink-soft">Minimum order is 12 pieces.</span>
            <button
              type="button"
              onClick={() => update("sizesLater", false)}
              className="font-semibold text-dream-purple underline decoration-dream-purple/55 decoration-[1.5px] underline-offset-4 transition-colors hover:decoration-dream-purple"
            >
              Add size breakdown
            </button>
          </div>
        </Field>
      ) : (
        <Field label="Size breakdown" error={errors.sizes}>
          <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
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
          <div className="mt-2 flex items-center justify-between text-[14px]">
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
              className="font-semibold text-dream-purple underline decoration-dream-purple/55 decoration-[1.5px] underline-offset-4 transition-colors hover:decoration-dream-purple"
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

// The form phase edits the exact same prints list the calculator does, so the
// running estimate in the sticky bar always matches what's on screen.
function StepPrint({
  prints,
  setPrints,
  lines,
  decoration,
  productLabel,
  errors,
}: {
  prints: PrintSpec[];
  setPrints: (p: PrintSpec[]) => void;
  lines: PrintPriceLine[];
  decoration: Decoration;
  productLabel: string;
  errors: Record<string, string>;
}) {
  return (
    <PrintsEditor
      prints={prints}
      setPrints={setPrints}
      lines={lines}
      decoration={decoration}
      productLabel={productLabel}
      strong
      error={errors.prints}
    />
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
            <p className="text-[14px] text-dream-ink-soft">
              Artwork, mockups, logos, PNG, JPG, PDF, AI, EPS (max 25MB each)
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
                  <p className="text-[14px] text-dream-ink-soft">{(f.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="text-[14px] font-semibold text-red-700 hover:underline"
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
  const [priceMatchMode, setPriceMatchMode] = useState<"link" | "file">(
    data.priceMatchLink ? "link" : files.length > 0 ? "file" : "link",
  );

  return (
    <div className="space-y-5">
      <Field label="When do you need this by?" htmlFor="needed">
        <input
          id="needed"
          type="date"
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
        <p className="mb-3 text-[14px] text-dream-ink-soft">
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
                      <p className="text-[14px] text-dream-ink-soft">{(f.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      className="text-[14px] font-semibold text-red-700 hover:underline"
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

function PillButton({
  active,
  onClick,
  children,
  compact = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full font-display font-semibold transition ${
        compact
          ? "min-w-[34px] px-2.5 py-1.5 text-[14px]"
          : "min-w-[44px] px-4 py-2 text-[14px]"
      } ${
        active
          ? "bg-dream-purple text-white"
          : "border border-dream-ink/15 bg-white text-dream-ink hover:border-dream-ink/40"
      }`}
    >
      {children}
    </button>
  );
}
