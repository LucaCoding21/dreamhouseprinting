import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import HeroDog from "@/components/HeroDog";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

type Method = {
  name: string;
  tagline: string;
  bestFor: string[];
  startingAt: string;
  blob: string;
  blobWidth: number;
  blobHeight: number;
  blobScale?: string;
  blobRotate?: number;
  dog: string;
  dogWidth: string;
  dogOffsetX?: string;
  dogOffsetY?: string;
};

const METHODS: Method[] = [
  {
    name: "Screen printing",
    tagline: "Ink pushed through a stencil, one colour at a time.",
    bestFor: [
      "Bulk orders (25+)",
      "Bold, solid-colour designs",
      "T-shirts, hoodies, totes",
    ],
    startingAt: "from $8 / unit",
    blob: "/how it works/1blob.svg",
    blobWidth: 255,
    blobHeight: 310,
    blobScale: "92%",
    blobRotate: -12,
    dog: "/how it works/step1.apng",
    dogWidth: "500px",
    dogOffsetX: "30px",
  },
  {
    name: "Embroidery",
    tagline: "Thread stitched directly into the fibre.",
    bestFor: [
      "Polos, dress shirts, uniforms",
      "Hats, toques, caps",
      "Logos on chest or sleeve",
    ],
    startingAt: "from $12 / unit",
    blob: "/how it works/2blob.svg",
    blobWidth: 317,
    blobHeight: 255,
    dog: "/how it works/step2.apng",
    dogWidth: "500px",
    dogOffsetY: "24px",
  },
];

type ProductCategory = {
  name: string;
  brands: string[];
  startingAt: string;
  image: string;
  imageWidth: string;
  blob: string;
  blobWidth: number;
  blobHeight: number;
  tagTilt: number;
  href: string;
};

const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    name: "Shirts",
    brands: ["Gildan", "Bella+Canvas", "Comfort Colors"],
    startingAt: "$12",
    image: "/shopbycategories/shirtcategory.webp",
    imageWidth: "60%",
    blob: "/shopbycategories/shirtblob.svg",
    blobWidth: 333,
    blobHeight: 267,
    tagTilt: -6,
    href: "/quote?product=shirt",
  },
  {
    name: "Hoodies",
    brands: ["Gildan", "Bella+Canvas", "Independent"],
    startingAt: "$32",
    image: "/shopbycategories/hoodiecategory.webp",
    imageWidth: "62%",
    blob: "/shopbycategories/hoodieblob.svg",
    blobWidth: 360,
    blobHeight: 284,
    tagTilt: 5,
    href: "/quote?product=hoodie",
  },
  {
    name: "Hats & toques",
    brands: ["Flexfit", "Richardson", "Yupoong"],
    startingAt: "$18",
    image: "/shopbycategories/hatcategory.webp",
    imageWidth: "68%",
    blob: "/shopbycategories/hatblob.svg",
    blobWidth: 357,
    blobHeight: 288,
    tagTilt: -4,
    href: "/quote?product=hat",
  },
  {
    name: "Bags & totes",
    brands: ["Liberty Bags", "BAGedge", "Port Authority"],
    startingAt: "$14",
    image: "/shopbycategories/bagscategory.webp",
    imageWidth: "56%",
    blob: "/shopbycategories/bagsblob.svg",
    blobWidth: 358,
    blobHeight: 269,
    tagTilt: 6,
    href: "/quote?product=bag",
  },
];

const PRICING_FACTORS = [
  {
    n: 1,
    title: "Quantity",
    body: "The biggest lever. 50 shirts costs less per-unit than 25. At 250+ it gets noticeably better again.",
  },
  {
    n: 2,
    title: "Print colours",
    body: "Each colour is its own screen and setup. A 1-colour design is cheapest; 4 is where costs climb.",
  },
  {
    n: 3,
    title: "Print locations",
    body: "Front-only is baseline. Back or sleeve add another run. Roughly +30–60% per spot.",
  },
  {
    n: 4,
    title: "Garment choice",
    body: "Gildan 5000 is our baseline blank. Bella+Canvas Airlume or Comfort Colors costs more and feels it.",
  },
];

type Tier = {
  qty: string;
  price: string;
  note?: string;
};

const TIERS: Tier[] = [
  { qty: "25–49 units", price: "$12 / unit" },
  { qty: "50–99 units", price: "$10 / unit" },
  { qty: "100–249 units", price: "$8 / unit" },
  { qty: "250+ units", price: "$6 / unit", note: "best value" },
];

const FAQS = [
  {
    q: "Can I use my own artwork?",
    a: "Yes. Send vector (.ai, .eps, .pdf) or a 300dpi .png. If you only have a phone JPEG, we'll help clean it up — small charge may apply.",
  },
  {
    q: "What if I don't have a design?",
    a: "We work from a sketch, a rough idea, or a reference. We design in-house or pair you with a designer we trust. You see a mockup before anything gets printed.",
  },
  {
    q: "Do you do samples?",
    a: "Yes. We can ship a blank to check fit, or quote a small pre-production run (3–5 pieces) so you see the actual print first.",
  },
  {
    q: "Can I mix sizes in one order?",
    a: "Absolutely. Pricing is per-unit regardless of size. 2XL+ carries a $2–4 garment upcharge depending on the product.",
  },
  {
    q: "Combine multiple products in one order?",
    a: "Yes, but minimums apply per type. 25 shirts + 25 hoodies prices as two jobs, not one combined 50-piece run.",
  },
  {
    q: "What if I need a revision on the mockup?",
    a: "Revisions are free and expected. We don't hit print until you're happy. Most orders go through 1–2 rounds.",
  },
];

// 12 sun rays around the CTA pill — original layout.
const CTA_RAYS = Array.from({ length: 12 }, (_, i) => {
  const angle = i * 30;
  const rad = (angle * Math.PI) / 180;
  const rx = 148;
  const ry = 72;
  const lenJitter = [22, 18, 20, 17, 22, 16, 20, 18, 21, 17, 19, 18][i];
  const angleJitter = [-3, 4, -2, 5, -4, 2, -3, 4, -5, 3, -2, 4][i];
  return {
    x: +(Math.cos(rad) * rx).toFixed(1),
    y: +(Math.sin(rad) * ry).toFixed(1),
    r: angle + angleJitter,
    len: lenJitter,
    delay: +(((i * 83) % 450) / 1000).toFixed(2),
  };
});

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-dream-cream">
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>

      <BlobMorphFilter />

      <Hero />
      <Methods />
      <Products />
      <Pricing />
      <FAQ />
      <CTA />

      <SiteFooter />
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Hero
// ────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="mx-auto grid max-w-[1400px] gap-10 px-6 pb-16 pt-14 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-14 lg:px-10 lg:pb-20 lg:pt-20">
      <div>
        <span className="inline-flex items-center gap-2 font-display text-[12px] font-bold uppercase tracking-[0.28em] text-dream-purple">
          <span className="h-1.5 w-1.5 rounded-full bg-dream-purple" />
          Services
        </span>
        <h1 className="mt-5 font-display text-[44px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-6xl lg:text-[80px]">
          What we{" "}
          <span className="relative inline-block">
            do
            <ScribbleUnderline className="-bottom-1 lg:-bottom-2" />
          </span>
          , and how.
        </h1>
        <p className="mt-6 max-w-[540px] text-base leading-relaxed text-dream-ink-soft sm:text-lg">
          Screen printing, embroidery, and the blanks to put them on. Pricing,
          turnaround, and answers to common questions — all in one page.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-5">
          <Link
            href="/quote"
            className="rough-pill rough-pill-filled rough-pill-lean inline-flex items-center justify-center px-8 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Get a quote
          </Link>
          <a
            href="#pricing"
            className="font-display text-sm font-bold uppercase tracking-[0.18em] text-dream-purple underline-offset-4 hover:underline"
          >
            See pricing →
          </a>
        </div>
      </div>

      <HeroDog />
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Methods
// ────────────────────────────────────────────────────────────────────────────

function Methods() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pb-20 pt-10 lg:px-10 lg:pb-24 lg:pt-12">
      <SectionHeader
        kicker="Methods"
        title={
          <>
            Two ways to{" "}
            <span className="relative inline-block">
              print
              <ScribbleUnderline className="-bottom-1" />
            </span>
            .
          </>
        }
        subtitle="Both done in-house. Pick the one that fits your job."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
        {METHODS.map((m) => (
          <article
            key={m.name}
            className="rough-card relative flex flex-col px-7 pb-8 pt-7 sm:px-9 sm:pb-9 sm:pt-8"
          >
            <span className="absolute -top-3 right-5 inline-flex -rotate-3 items-center rounded-full bg-dream-sun px-3.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-dream-ink shadow-[0_3px_0_0_rgba(27,20,88,0.15)]">
              {m.startingAt}
            </span>

            <div className="relative mx-auto flex h-[360px] w-full max-w-[460px] items-center justify-center sm:h-[400px]">
              <Image
                src={m.blob}
                alt=""
                width={m.blobWidth}
                height={m.blobHeight}
                className="blob-morph absolute inset-0 m-auto object-contain"
                style={{
                  width: m.blobScale ?? "72%",
                  height: m.blobScale ?? "72%",
                  ...(m.blobRotate
                    ? { transform: `rotate(${m.blobRotate}deg)` }
                    : {}),
                }}
                aria-hidden="true"
              />
              <Image
                src={m.dog}
                alt=""
                width={460}
                height={460}
                unoptimized
                className="relative z-10 h-auto"
                style={{
                  width: m.dogWidth,
                  transform:
                    m.dogOffsetX || m.dogOffsetY
                      ? `translate(${m.dogOffsetX ?? "0"}, ${m.dogOffsetY ?? "0"})`
                      : undefined,
                }}
                aria-hidden="true"
              />
            </div>

            <h3 className="mt-2 font-display text-3xl font-bold text-dream-ink sm:text-[34px]">
              {m.name}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-dream-ink-soft">
              {m.tagline}
            </p>

            <ul className="mt-5 flex flex-col gap-2.5">
              {m.bestFor.map((item) => (
                <li
                  key={item}
                  className="flex gap-2.5 text-[14px] leading-relaxed text-dream-ink-soft"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 18 18"
                    className="mt-[3px] h-4 w-4 shrink-0 text-dream-purple"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 9.5 l3.5 3 l7-7" />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Products
// ────────────────────────────────────────────────────────────────────────────

function Products() {
  return (
    <section className="bg-dream-lavender-soft py-20 lg:py-24">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <SectionHeader
          kicker="Products"
          title={
            <>
              What we print{" "}
              <span className="relative inline-block">
                on
                <ScribbleUnderline className="-bottom-1" />
              </span>
              .
            </>
          }
          subtitle="The blanks we keep on hand. Ask if you don't see something."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
          {PRODUCT_CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className="rough-card group relative flex flex-col px-5 pb-6 pt-5 transition-transform hover:-translate-y-1"
            >
              <span
                aria-hidden="true"
                className="price-tag-alive pointer-events-none absolute -top-3 right-4 z-20 inline-flex items-baseline gap-1 rounded-full bg-dream-purple px-3.5 py-1.5 font-display text-white shadow-[0_3px_0_0_rgba(27,20,88,0.25)]"
                style={{ "--base-tilt": `${cat.tagTilt}deg` } as CSSProperties}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/75">
                  from
                </span>
                <span className="font-display text-[15px] font-bold">
                  {cat.startingAt}
                </span>
              </span>

              <div className="relative flex aspect-[4/3] items-center justify-center">
                <Image
                  src={cat.blob}
                  alt=""
                  width={cat.blobWidth}
                  height={cat.blobHeight}
                  className="blob-morph absolute inset-0 h-full w-full object-contain"
                  aria-hidden="true"
                />
                <Image
                  src={cat.image}
                  alt=""
                  width={400}
                  height={400}
                  className="relative z-10 h-auto"
                  style={{ width: cat.imageWidth }}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <h3 className="font-display text-xl font-bold text-dream-ink">
                  {cat.name}
                </h3>
                <div>
                  <div className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-dream-ink/45">
                    Brands
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cat.brands.map((brand) => (
                      <span
                        key={brand}
                        className="inline-flex items-center rounded-[6px] border-2 border-dream-ink/15 bg-white px-2 py-[3px] font-display text-[11px] font-bold text-dream-ink shadow-[0_1.5px_0_0_rgba(27,20,88,0.12)]"
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pricing
// ────────────────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="bg-dream-cream py-20 lg:py-24">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <SectionHeader
          kicker="Pricing"
          title={
            <>
              Four levers, in{" "}
              <span className="relative inline-block">
                order
                <ScribbleUnderline className="-bottom-1" />
              </span>
              .
            </>
          }
          subtitle="No public calculator (yet) — the real number depends on specifics. Here's the logic so you can ballpark."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING_FACTORS.map((f) => (
            <div
              key={f.title}
              className="rough-card relative px-6 py-7"
            >
              <NumberCircle n={f.n} />
              <h3 className="mt-4 font-display text-lg font-bold text-dream-ink">
                {f.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-dream-ink-soft">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        {/* Tier table */}
        <div className="rough-card relative mt-12 overflow-hidden">
          <div className="flex flex-col gap-3 px-7 pb-6 pt-7 sm:flex-row sm:items-end sm:justify-between sm:px-10 sm:pt-9">
            <div>
              <h3 className="font-display text-2xl font-bold text-dream-ink sm:text-3xl">
                More you order, less it costs.
              </h3>
              <p className="mt-2 max-w-[520px] text-[14px] text-dream-ink-soft">
                Example: 1-colour front print on a Gildan tee.
              </p>
            </div>
            <span className="inline-flex shrink-0 -rotate-2 items-center rounded-full bg-dream-sun px-3.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-dream-ink shadow-[0_3px_0_0_rgba(27,20,88,0.15)]">
              Example · Not a quote
            </span>
          </div>

          <ul className="border-t border-dream-ink/10">
            {TIERS.map((tier) => (
              <li
                key={tier.qty}
                className="flex items-center justify-between gap-4 border-b border-dream-ink/10 px-7 py-5 last:border-b-0 sm:px-10"
              >
                <span className="font-display text-[15px] font-semibold text-dream-ink sm:text-base">
                  {tier.qty}
                </span>
                <div className="flex items-center gap-3">
                  {tier.note ? (
                    <span className="inline-flex items-center rounded-full bg-dream-purple px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      {tier.note}
                    </span>
                  ) : null}
                  <span className="font-display text-lg font-bold text-dream-ink sm:text-xl">
                    {tier.price}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FAQ
// ────────────────────────────────────────────────────────────────────────────

function FAQ() {
  return (
    <section className="bg-dream-lavender-soft py-20 lg:py-24">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10">
        <SectionHeader
          kicker="FAQ"
          title={
            <>
              Things people{" "}
              <span className="relative inline-block">
                ask
                <ScribbleUnderline className="-bottom-1" />
              </span>
              .
            </>
          }
          center
        />

        <div className="mt-10 flex flex-col gap-3">
          {FAQS.map((item, i) => (
            <details
              key={item.q}
              className="rough-card group relative px-6 py-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-base font-bold text-dream-ink sm:text-lg">
                <span className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-display text-[13px] font-bold text-dream-purple"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.q}
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dream-purple font-display text-xl leading-none text-white transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-4 pl-9 pr-10 text-[14px] leading-relaxed text-dream-ink-soft sm:text-[15px]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CTA — original sun-burst
// ────────────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="relative overflow-hidden bg-dream-purple text-white">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center px-6 py-20 text-center lg:px-10 lg:py-24">
        <h2 className="font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl lg:text-[64px]">
          Ready when{" "}
          <span className="relative inline-block">
            you are.
            <ScribbleUnderline className="-bottom-1 lg:-bottom-2" />
          </span>
        </h2>
        <p className="mt-6 max-w-[520px] text-[15px] leading-relaxed text-white/80 sm:text-base">
          Tell us what you want and we'll come back with a real number, usually
          within a business day.
        </p>

        <div className="mt-10">
          <div
            className="sun-burst relative inline-block"
            style={{ "--ray-color": "#ffffff" } as CSSProperties}
          >
            {CTA_RAYS.map((ray, i) => (
              <span
                key={i}
                aria-hidden
                className="sun-ray"
                style={
                  {
                    "--x": `${ray.x}px`,
                    "--y": `${ray.y}px`,
                    "--r": `${ray.r}deg`,
                    "--delay": `${ray.delay}s`,
                    width: `${ray.len}px`,
                  } as CSSProperties
                }
              />
            ))}
            <Link
              href="/quote"
              className="rough-pill rough-pill-white rough-pill-lean relative inline-flex items-center justify-center px-10 py-5 font-display text-lg font-bold text-dream-ink transition-transform hover:-translate-y-0.5"
            >
              Start your order
            </Link>
          </div>
        </div>

        <p className="mt-6 text-[13px] text-white/70">
          Or{" "}
          <Link
            href="/contact"
            className="font-semibold text-white underline-offset-4 hover:underline"
          >
            just ask us a question
          </Link>
          , we reply fast.
        </p>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────────────────

function BlobMorphFilter() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
      <defs>
        <filter id="blob-morph" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018"
            numOctaves="2"
            seed="1"
            result="noise"
          >
            <animate
              attributeName="seed"
              values="1;2;3"
              dur="1.2s"
              repeatCount="indefinite"
              calcMode="discrete"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" />
        </filter>
      </defs>
    </svg>
  );
}

function ScribbleUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 12"
      preserveAspectRatio="none"
      className={`absolute left-0 right-0 h-[12px] w-full ${className}`}
    >
      <path
        d="M4 7 C 20 3, 40 9, 60 6 S 100 3, 120 7 S 160 4, 184 7 S 210 8, 216 6"
        stroke="#ecbb25"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function NumberCircle({ n }: { n: number }) {
  return (
    <span className="relative inline-flex h-12 w-12 items-center justify-center">
      <Image
        src="/how it works/number-circle.svg"
        alt=""
        width={48}
        height={49}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <span className="relative font-display text-[17px] font-bold text-white">
        {n}
      </span>
    </span>
  );
}

function SectionHeader({
  kicker,
  title,
  subtitle,
  center,
}: {
  kicker?: string;
  title: React.ReactNode;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div
      className={
        center ? "mx-auto max-w-[680px] text-center" : "max-w-[820px]"
      }
    >
      {kicker ? (
        <span
          className={`inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.28em] text-dream-purple ${
            center ? "justify-center" : ""
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-dream-purple" />
          {kicker}
        </span>
      ) : null}
      <h2
        className={`${
          kicker ? "mt-4" : ""
        } font-display text-3xl font-bold leading-[1.05] tracking-tight text-dream-ink sm:text-4xl lg:text-[44px]`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

