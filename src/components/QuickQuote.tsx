"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const DREAM_LETTERS = ["D", "R", "E", "A", "M"] as const;
const DREAM_COLORS = [
  "#e85d2f", // 1st color — orange-red
  "#2b6ef4", // 2nd — blue
  "#22b6a1", // 3rd — teal
  "#f2b134", // 4th — gold
  "#a855f7", // 5th — magenta
];
const DEFAULT_LETTER = "#2a1b8a";

const PRODUCT_TYPES = ["Shirt", "Hoodie", "Hat/Toque", "Other"] as const;
const PRINT_METHODS = ["Print", "Embroidery"] as const;

type ProductType = (typeof PRODUCT_TYPES)[number];
type PrintMethod = (typeof PRINT_METHODS)[number];

export default function QuickQuote() {
  const [productType, setProductType] = useState<ProductType>("Shirt");
  const [printMethod, setPrintMethod] = useState<PrintMethod>("Print");
  const [searchQuery, setSearchQuery] = useState("");
  const [quantity, setQuantity] = useState("50");
  const [printColors, setPrintColors] = useState("");
  const [printLocations, setPrintLocations] = useState("");

  return (
    <section className="bg-dream-purple">
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-[1550px] items-center px-6 py-6 lg:px-10">
        <div className="relative grid w-full items-center gap-8 lg:grid-cols-[440px_820px] lg:justify-center lg:gap-24">
          <div className="text-white">
            <h2 className="font-display text-6xl font-bold leading-[1.02] tracking-tight text-white sm:text-7xl lg:text-[72px]">
              Get a <span className="whitespace-nowrap">quick quote</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90">
              Tell us what you need and get a ballpark estimate in seconds. No account required.
            </p>
          </div>

          <div className="rough-card relative grid gap-8 px-7 py-8 sm:px-9 sm:py-9 lg:grid-cols-[1.7fr_1fr] lg:items-center lg:gap-10">
            <form className="flex flex-col gap-6">
              {/* Group 1: what are we printing */}
              <Field label="Product Type">
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_TYPES.map((t) => (
                    <PillButton
                      key={t}
                      active={productType === t}
                      onClick={() => setProductType(t)}
                    >
                      {t}
                    </PillButton>
                  ))}
                </div>
              </Field>

              <Field label="Search by product (optional)" muted>
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dream-ink/35"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search SKU or product"
                    className="w-full rounded-full border border-dream-ink/12 bg-white py-2.5 pl-11 pr-4 text-sm text-dream-ink placeholder:text-dream-ink/40 focus:border-dream-purple focus:outline-none"
                  />
                </div>
              </Field>

              {/* Group 2: how it's printed — Proximity groups these tighter */}
              <div className="flex flex-col gap-5">
                <Field label="Print method">
                  <div className="flex flex-wrap gap-2">
                    {PRINT_METHODS.map((m) => (
                      <PillButton
                        key={m}
                        active={printMethod === m}
                        onClick={() => setPrintMethod(m)}
                      >
                        {m}
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

                <div className="grid grid-cols-[120px_1fr] gap-4">
                  <Field label="Quantity" inline>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full rounded-lg border border-dream-ink/12 bg-white px-4 py-2.5 text-sm text-dream-ink focus:border-dream-purple focus:outline-none"
                    />
                  </Field>
                  <Field label="Print locations" inline>
                    <input
                      type="text"
                      value={printLocations}
                      onChange={(e) => setPrintLocations(e.target.value)}
                      placeholder="e.g. front, left sleeve"
                      className="w-full rounded-lg border border-dream-ink/12 bg-white px-4 py-2.5 text-sm text-dream-ink placeholder:text-dream-ink/35 focus:border-dream-purple focus:outline-none"
                    />
                  </Field>
                </div>
              </div>

              {/* Group 3: artwork upload */}
              <div className="rounded-2xl border border-dashed border-dream-ink/25 px-4 py-5 text-center text-sm text-dream-ink/55">
                Upload your artwork <span className="text-dream-ink/35">(optional)</span>
                <span className="mt-0.5 block text-[11px] text-dream-ink/35">
                  .png · .ai · .pdf · .eps
                </span>
              </div>

              {/* Group 4: actions — primary clearly dominant (Fitts) */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/quote"
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-dream-sun px-6 py-3.5 font-display text-sm font-bold text-dream-ink shadow-[0_3px_0_0_rgba(27,20,88,0.15)] transition hover:-translate-y-0.5 sm:flex-none"
                >
                  Start your order
                </Link>
                <Link
                  href="/quote"
                  className="font-display text-sm font-semibold text-dream-ink/70 underline-offset-4 transition hover:text-dream-ink hover:underline"
                >
                  Get a detailed quote →
                </Link>
              </div>
            </form>

            <HoodieDiagram colorCount={parseColorCount(printColors)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
  inline,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  inline?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={inline ? "" : ""}>
      <div
        className={`mb-1.5 font-display text-[13px] font-bold ${
          muted ? "text-dream-ink/60" : "text-dream-ink"
        }`}
      >
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
