"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GARMENT_BRAND_OPTIONS,
  GARMENT_COLORS,
  PRINT_COLOR_OPTIONS,
  PRINT_LOCATIONS,
  PRINT_METHOD_OPTIONS,
  PRODUCT_OPTIONS,
  SIZE_KEYS,
  emptyFormData,
  sumSizes,
  type GarmentBrand,
  type PrintLocation,
  type PrintMethod,
  type ProductType,
  type QuoteFormData,
  type SizeBreakdown,
  type SizeKey,
} from "@/lib/formTypes";

const STEPS = [
  { key: "contact", title: "Get in Contact", subtitle: "So Julian can send your quote back." },
  { key: "product", title: "What are you printing on?", subtitle: "Garment, color, and how many." },
  { key: "print", title: "Print details", subtitle: "Where it goes and how it's printed." },
  { key: "artwork", title: "Upload your artwork", subtitle: "PNG, JPG, PDF, AI or EPS — whatever you've got." },
  { key: "timeline", title: "Timeline & notes", subtitle: "When you need it and anything else." },
] as const;

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

type StepIndex = 0 | 1 | 2 | 3 | 4;

export default function QuoteForm() {
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

  // Reset scroll to top whenever the step changes so the user always starts
  // at the step heading.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

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

  const stepErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!data.name.trim()) errs.name = "We need a name to put on your quote.";
      if (!data.email.trim()) errs.email = "Email is required so Julian can reply.";
      else if (!isValidEmail(data.email)) errs.email = "That email doesn't look right.";
      if (!data.phone.trim()) errs.phone = "Phone is required.";
    }
    if (step === 1) {
      if (!data.productType) errs.productType = "Pick what you're printing on.";
      if (!data.garmentBrand) errs.garmentBrand = "Pick a brand tier (or let Julian choose).";
      if (!data.garmentColor.trim()) errs.garmentColor = "Give us a garment color.";
      if (data.sizesLater) {
        if (!data.quantity.trim()) errs.quantity = "How many pieces total?";
        else if (Number(data.quantity) <= 0) errs.quantity = "Quantity must be a positive number.";
      } else {
        const total = sumSizes(data.sizes);
        if (total <= 0) errs.sizes = "Enter at least one size count.";
      }
    }
    if (step === 2) {
      if (!data.printColors) errs.printColors = "How many print colors?";
      if (data.printLocations.length === 0) errs.printLocations = "Pick at least one print location.";
    }
    // Step 3 (artwork) and 4 (timeline) have no hard-required fields beyond softer guidance.
    return errs;
  }, [step, data]);

  const canAdvance = Object.keys(stepErrors).length === 0;

  const onNext = () => {
    setTouchedNext(true);
    if (!canAdvance) return;
    setTouchedNext(false);
    setStep((s) => Math.min(4, s + 1) as StepIndex);
  };

  const onBack = () => {
    setTouchedNext(false);
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
        // Fallback: also accept by extension for .ai / .eps
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
      // When the user filled in a size breakdown, the effective quantity is
      // the sum — don't trust whatever was in `data.quantity` previously.
      const effectiveQuantity = data.sizesLater
        ? data.quantity
        : String(sumSizes(data.sizes));
      const payload: QuoteFormData = { ...data, quantity: effectiveQuantity };

      const body = new FormData();
      body.append("payload", JSON.stringify(payload));
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

  if (submitted) return <SuccessCard />;

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-8 sm:max-w-lg">
      <Header />

      <ProgressBar step={step} total={STEPS.length} />

      <div className="mt-5">
        <h1 className="font-display text-3xl font-bold leading-tight text-dream-ink sm:text-4xl">
          {STEPS[step].title}
        </h1>
        <p className="mt-1 text-sm text-dream-ink-soft">{STEPS[step].subtitle}</p>
      </div>

      <div className="mt-6 flex-1">
        {step === 0 && (
          <StepContact
            data={data}
            update={update}
            errors={touchedNext ? stepErrors : {}}
          />
        )}
        {step === 1 && (
          <StepProduct
            data={data}
            update={update}
            errors={touchedNext ? stepErrors : {}}
          />
        )}
        {step === 2 && (
          <StepPrint
            data={data}
            update={update}
            toggleLocation={toggleLocation}
            errors={touchedNext ? stepErrors : {}}
          />
        )}
        {step === 3 && (
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
        {step === 4 && (
          <StepTimeline
            data={data}
            update={update}
            files={priceMatchFiles}
            onPick={() => priceMatchInputRef.current?.click()}
            onRemove={(i) => removeFile(i, setPriceMatchFiles)}
            inputRef={priceMatchInputRef}
            onChange={(e) => handleFilePick(e, setPriceMatchFiles)}
          />
        )}
      </div>

      {submitError && (
        <div className="mt-4 rounded-xl border border-red-400/60 bg-red-100/70 px-4 py-3 text-sm text-red-900">
          {submitError}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="h-14 flex-1 rounded-2xl border-2 border-dream-ink/80 bg-transparent font-display text-lg font-semibold text-dream-ink transition active:scale-[0.98] disabled:opacity-50"
          >
            Back
          </button>
        )}
        {step < 4 ? (
          <button
            type="button"
            onClick={onNext}
            className="h-14 flex-[2] rounded-2xl border-2 border-dream-ink bg-white font-display text-xl font-bold text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)]"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="h-14 flex-[2] rounded-2xl border-2 border-dream-ink bg-white font-display text-xl font-bold text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)] disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit :)"}
          </button>
        )}
      </div>

      <Footer />
    </div>
  );
}

/* ---------- Layout pieces ---------- */

function Header() {
  return (
    <header className="flex items-center gap-3">
      <Image
        src="/dreamhouse-logo.svg"
        alt="Dreamhouse Printing"
        width={52}
        height={48}
        priority
      />
      <h2 className="font-display text-2xl font-extrabold leading-none text-dream-purple sm:text-3xl">
        Dreamhouse
        <br />
        Printing
      </h2>
    </header>
  );
}

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

function Footer() {
  return (
    <footer className="mt-10 border-t border-dream-ink/20 pt-5 text-center">
      <p className="text-sm font-semibold text-dream-ink-soft">
        Have a quote from another printer?
      </p>
      <p className="mt-1 text-xs text-dream-ink-soft">
        Submit a link or file from{" "}
        <span className="font-semibold text-dream-ink">Get Bold</span> or{" "}
        <span className="font-semibold text-dream-ink">Coastal Reign</span> on the
        last step for Julian's price match.
      </p>
    </footer>
  );
}

function SuccessCard() {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <Image
        src="/dreamhouse-logo.svg"
        alt="Dreamhouse Printing"
        width={96}
        height={88}
        priority
      />
      <h1 className="mt-6 font-display text-4xl font-bold text-dream-ink">
        Got it! :)
      </h1>
      <p className="mt-4 text-lg text-dream-ink-soft">
        Julian will get back to you within <span className="font-semibold text-dream-ink">24 hours</span> with your quote.
      </p>
      <p className="mt-2 text-sm text-dream-ink-soft">
        In the meantime, check your email for a confirmation.
      </p>
      <a
        href="/"
        className="mt-10 inline-flex h-12 items-center justify-center rounded-2xl border-2 border-dream-ink bg-white px-6 font-display text-base font-bold text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)]"
      >
        Submit another quote
      </a>
    </div>
  );
}

/* ---------- Fields ---------- */

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
      <span className="mb-1.5 block text-sm font-semibold text-dream-ink">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-xs font-medium text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border-2 border-dream-ink/80 bg-white px-4 py-3.5 text-base text-dream-ink placeholder:text-dream-ink/40 outline-none transition focus:border-dream-purple focus:ring-4 focus:ring-dream-purple/20";

/* ---------- Step 1: Contact ---------- */

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
          onChange={(e) => update("phone", e.target.value)}
          placeholder="(555) 123-4567"
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
    </div>
  );
}

/* ---------- Step 2: Product ---------- */

function StepProduct({
  data,
  update,
  errors,
}: {
  data: QuoteFormData;
  update: <K extends keyof QuoteFormData>(k: K, v: QuoteFormData[K]) => void;
  errors: Record<string, string>;
}) {
  const sizeTotal = sumSizes(data.sizes);
  const setSize = (key: SizeKey, value: string) => {
    // Strip non-digits so the input stays numeric-only.
    const clean = value.replace(/[^\d]/g, "");
    const next: SizeBreakdown = { ...data.sizes };
    if (clean === "" || clean === "0") delete next[key];
    else next[key] = clean;
    update("sizes", next);
  };

  return (
    <div className="space-y-5">
      <Field label="What are you printing on?" error={errors.productType}>
        <div className="grid grid-cols-2 gap-2">
          {PRODUCT_OPTIONS.map((opt) => {
            const selected = data.productType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("productType", opt.value as ProductType)}
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

      <Field label="Brand tier" error={errors.garmentBrand}>
        <div className="grid grid-cols-2 gap-2">
          {GARMENT_BRAND_OPTIONS.map((opt) => {
            const selected = data.garmentBrand === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("garmentBrand", opt.value as GarmentBrand)}
                className={`rounded-2xl border-2 px-3 py-3 text-left transition ${
                  selected
                    ? "border-dream-ink bg-dream-purple text-white shadow-[0_3px_0_0_rgba(27,20,88,0.9)]"
                    : "border-dream-ink/80 bg-white text-dream-ink hover:bg-dream-cream"
                }`}
              >
                <span className="block font-display text-base font-semibold leading-tight">
                  {opt.label}
                </span>
                <span
                  className={`block text-xs ${
                    selected ? "text-white/80" : "text-dream-ink-soft"
                  }`}
                >
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Garment color" error={errors.garmentColor} htmlFor="color">
        <input
          id="color"
          type="text"
          value={data.garmentColor}
          onChange={(e) => update("garmentColor", e.target.value)}
          placeholder="e.g. Heather grey"
          className={inputCls}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {GARMENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => update("garmentColor", c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                data.garmentColor.toLowerCase() === c.toLowerCase()
                  ? "border-dream-ink bg-dream-ink text-white"
                  : "border-dream-ink/40 bg-white/70 text-dream-ink hover:border-dream-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
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
            <span className="text-dream-ink-soft">
              Minimum order is 12 pieces.
            </span>
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
                  <span className="font-display text-sm font-bold text-dream-ink">
                    {k}
                  </span>
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
                <span className="ml-1 font-normal text-dream-ink-soft">
                  (min 12)
                </span>
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

/* ---------- Step 3: Print ---------- */

function StepPrint({
  data,
  update,
  toggleLocation,
  errors,
}: {
  data: QuoteFormData;
  update: <K extends keyof QuoteFormData>(k: K, v: QuoteFormData[K]) => void;
  toggleLocation: (loc: PrintLocation) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-5">
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

      <Field label="Print method">
        <div className="space-y-2">
          {PRINT_METHOD_OPTIONS.map((opt) => {
            const selected = data.printMethod === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("printMethod", opt.value as PrintMethod)}
                className={`w-full rounded-2xl border-2 px-4 py-3 text-left font-medium transition ${
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
    </div>
  );
}

/* ---------- Step 4: Artwork ---------- */

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
            <p className="font-display text-lg font-bold text-dream-ink">
              Upload Files Here
            </p>
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
                  <p className="text-xs text-dream-ink-soft">
                    {(f.size / 1024).toFixed(0)} KB
                  </p>
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

/* ---------- Step 5: Timeline ---------- */

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
  const today = new Date().toISOString().split("T")[0];
  // Default to "link" if one was already typed, otherwise "file" if one was
  // picked, otherwise "link" (the simpler default for a fresh session).
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
          Share it here and Julian will try to beat it (Get Bold, Coastal Reign,
          etc.)
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
              <p className="text-sm font-semibold text-dream-ink">
                Upload price match file
              </p>
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
                      <p className="text-xs text-dream-ink-soft">
                        {(f.size / 1024).toFixed(0)} KB
                      </p>
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
