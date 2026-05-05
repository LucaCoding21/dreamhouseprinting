"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { calculatePrice } from "@/lib/pricing";
import AnimatedPrice from "./AnimatedPrice";
import type {
  PrintMethod as FormPrintMethod,
  ProductType as FormProductType,
} from "@/lib/formTypes";

const DREAM_LETTERS = ["D", "R", "E", "A", "M"] as const;
const DREAM_COLORS = [
  "#e85d2f", // 1st color — orange-red
  "#2b6ef4", // 2nd — blue
  "#22b6a1", // 3rd — teal
  "#f2b134", // 4th — gold
  "#a855f7", // 5th — magenta
];
const DEFAULT_LETTER = "#2a1b8a";

// Calculator exposes a friendlier subset of the form's product types. The
// `value` is what the form/pricing module expects, the `label` is what the
// customer sees.
const PRODUCT_OPTIONS: { value: FormProductType; label: string }[] = [
  { value: "t-shirts", label: "Shirt" },
  { value: "hoodies", label: "Hoodie" },
  { value: "hats", label: "Hat / Toque" },
  { value: "other", label: "Other" },
];
const PRINT_METHOD_OPTIONS: { value: FormPrintMethod; label: string }[] = [
  { value: "screen", label: "Print" },
  { value: "embroidery", label: "Embroidery" },
];
const QUANTITY_PRESETS = [25, 50, 100, 250, 500] as const;

export default function QuickQuote() {
  const [productType, setProductType] = useState<FormProductType>("t-shirts");
  const [printMethod, setPrintMethod] = useState<FormPrintMethod>("screen");
  const [quantity, setQuantity] = useState("50");
  const [useCustomQty, setUseCustomQty] = useState(false);
  const [printColors, setPrintColors] = useState("1");

  const colorCount = parseColorCount(printColors);
  const qtyNum = Math.max(0, parseInt(quantity, 10) || 0);
  const { perUnit } = calculatePrice(productType, printMethod, colorCount, qtyNum);
  const lockInHref = buildLockInHref({ productType, printMethod, colorCount, qtyNum });

  return (
    <section className="relative overflow-hidden">
      <Image
        src="/getaquickquote/shirts2.jpg"
        alt=""
        fill
        priority={false}
        sizes="100vw"
        className="absolute inset-0 z-0 object-cover"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 z-0"
        style={{ backgroundColor: "rgba(93, 92, 115, 0.86)" }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex max-w-[980px] items-center px-6 py-32 lg:px-10 lg:py-40">
        <div id="quick-quote" className="rough-card relative w-full scroll-mt-28 px-6 py-10 sm:px-12 sm:py-12">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold leading-tight text-dream-ink sm:text-4xl">
              Get A Quick Quote
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-dream-ink/65 sm:text-[15px]">
              Pick your product, method, colors and quantity. Your estimate updates as you go.
            </p>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-12">
            <form className="flex flex-col gap-5">
              <Field label="Product Type">
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_OPTIONS.map((opt) => (
                    <PillButton
                      key={opt.value}
                      active={productType === opt.value}
                      onClick={() => setProductType(opt.value)}
                    >
                      {opt.label}
                    </PillButton>
                  ))}
                </div>
              </Field>

              <Field label="Print method">
                <div className="flex flex-wrap gap-2">
                  {PRINT_METHOD_OPTIONS.map((opt) => (
                    <PillButton
                      key={opt.value}
                      active={printMethod === opt.value}
                      onClick={() => setPrintMethod(opt.value)}
                    >
                      {opt.label}
                    </PillButton>
                  ))}
                </div>
              </Field>

              <Field label="Print colors">
                <div className="flex flex-wrap gap-1.5">
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
                </div>
              </Field>

              <Field label="Quantity">
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
                  <PillButton
                    active={useCustomQty}
                    onClick={() => setUseCustomQty(true)}
                  >
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
              </Field>

              <PriceCard perUnit={perUnit} quantity={qtyNum} lockInHref={lockInHref} />
            </form>

            <HoodieDiagram colorCount={colorCount} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 font-display text-[13px] font-bold text-dream-ink">
        {label}
      </div>
      {children}
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
    <div className="relative hidden lg:flex lg:items-center lg:justify-center">
      <div className="relative aspect-square w-full">
        <Image
          src="/getaquickquote/hoodie.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 320px, 0px"
          className="object-contain"
          aria-hidden="true"
          priority
        />
        <div className="absolute inset-x-0 top-[48%] flex -translate-y-1/2 justify-center">
          <span className="font-display text-[30px] font-bold tracking-[0.04em]">
            {DREAM_LETTERS.map((letter, i) => (
              <span
                key={i}
                style={{
                  color: i < colorCount ? DREAM_COLORS[i] : DEFAULT_LETTER,
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
  lockInHref,
}: {
  perUnit: number;
  quantity: number;
  lockInHref: string;
}) {
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
      {!hasQty && (
        <div className="mt-2 text-xs text-dream-ink/55">Enter a quantity to see your price</div>
      )}
      {hasQty && (
        <Link
          href={lockInHref}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-dream-ink px-6 py-3.5 font-display text-base font-bold text-white shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)] sm:w-auto"
        >
          Lock in this price
        </Link>
      )}
    </div>
  );
}

function buildLockInHref({
  productType,
  printMethod,
  colorCount,
  qtyNum,
}: {
  productType: FormProductType;
  printMethod: FormPrintMethod;
  colorCount: number;
  qtyNum: number;
}): string {
  const params = new URLSearchParams({
    type: productType,
    method: printMethod,
    colors: String(colorCount),
    qty: String(qtyNum),
  });
  return `/quote?${params.toString()}`;
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
