import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import HeroDog from "@/components/HeroDog";
import ParallaxImage from "@/components/ParallaxImage";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

type Method = {
  name: string;
  description: string;
  image: string;
  imageClassName?: string;
  bg: string;
  titleColor: string;
  descColor: string;
  rotate: number;
};

const METHODS: Method[] = [
  {
    name: "Screen printing",
    description:
      "Bold, long-lasting prints. Best for bulk orders of tees, hoodies, and totes.",
    image: "/methods-screen.webp",
    imageClassName: "w-[150px] sm:w-[170px]",
    bg: "bg-dream-purple",
    titleColor: "text-white",
    descColor: "text-white/85",
    rotate: -3,
  },
  {
    name: "Embroidery",
    description:
      "Thread stitched into the fabric for a premium, textured finish on polos and hats.",
    image: "/methods-embroidery.webp",
    imageClassName: "w-[150px] -rotate-12 sm:w-[175px]",
    bg: "bg-white",
    titleColor: "text-dream-ink",
    descColor: "text-dream-ink-soft",
    rotate: 1.5,
  },
  {
    name: "DTG printing",
    description:
      "Direct-to-garment for full-colour, photo-quality prints with no minimum order.",
    image: "/methods-dtg.webp",
    imageClassName: "w-[200px] sm:w-[230px]",
    bg: "bg-dream-sun",
    titleColor: "text-dream-ink",
    descColor: "text-dream-ink-soft",
    rotate: 0,
  },
];

type ProductCategory = {
  name: string;
  brands: string[];
  startingAt: string;
  minQty: number;
  turnaround: string;
  image: string;
  href: string;
};

const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    name: "Shirts",
    brands: ["Gildan", "Bella+Canvas", "Comfort Colors"],
    startingAt: "$12",
    minQty: 25,
    turnaround: "7–10 days",
    image: "/products/shirts.jpg",
    href: "/quote?product=shirt",
  },
  {
    name: "Hoodies",
    brands: ["Gildan", "Bella+Canvas", "Independent"],
    startingAt: "$32",
    minQty: 25,
    turnaround: "7–10 days",
    image: "/products/hoodies.jpg",
    href: "/quote?product=hoodie",
  },
  {
    name: "Hats & toques",
    brands: ["Flexfit", "Richardson", "Yupoong"],
    startingAt: "$18",
    minQty: 24,
    turnaround: "10–14 days",
    image: "/products/hats2.jpg",
    href: "/quote?product=hat",
  },
  {
    name: "Bags & totes",
    brands: ["Liberty Bags", "BAGedge", "Port Authority"],
    startingAt: "$14",
    minQty: 25,
    turnaround: "7–10 days",
    image: "/products/bags2.jpg",
    href: "/quote?product=bag",
  },
];

const FAQS = [
  {
    q: "Can I use my own artwork?",
    a: "Yes. Send vector (.ai, .eps, .pdf) or a 300dpi .png. If you only have a phone JPEG, we'll help clean it up. Small charge may apply.",
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

// 12 sun rays around the CTA pill, original layout.
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

      <div className="bg-dream-purple text-white">
        <p className="mx-auto max-w-[1400px] px-6 py-3 text-center text-[15px] font-medium">
          Spring deal: 15% off orders of 50+ pieces. Submit your quote this month
        </p>
      </div>

      <BlobMorphFilter />

      <Hero />
      <Pitch />
      <Methods />

      <Products />
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
    <section className="mx-auto grid max-w-[1400px] gap-10 px-6 pb-16 pt-6 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-14 lg:px-10 lg:pb-20 lg:pt-8">
      <div>
        <h1 className="font-display text-[44px] font-semibold leading-[1.05] tracking-tight text-black sm:text-[56px] lg:text-[68px]">
          Custom prints, done <span className="whitespace-nowrap">in-house</span>.
        </h1>
        <p className="mt-6 max-w-[540px] text-base leading-relaxed text-dream-ink-soft sm:text-lg">
          Screen printing, embroidery, and the blanks to put them on. Pricing,
          turnaround, and answers to common questions all in one page.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-5">
          <Link
            href="/quote"
            className="rough-pill rough-pill-filled rough-pill-lean inline-flex items-center justify-center px-8 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Get a quote
          </Link>
        </div>
      </div>

      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-4 -right-6 z-10 h-28 w-28 animate-pop sm:-right-10 sm:h-36 sm:w-36 lg:-top-6 lg:-right-12 lg:h-44 lg:w-44"
          style={{ animationDelay: "80ms" }}
        >
          <Image
            src="/doodle1.png"
            alt=""
            width={300}
            height={300}
            className="h-full w-full -rotate-[20deg]"
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-2 -left-14 z-10 h-32 w-32 animate-pop sm:-left-20 sm:h-40 sm:w-40 lg:-bottom-4 lg:-left-28 lg:h-48 lg:w-48"
          style={{ animationDelay: "200ms" }}
        >
          <Image
            src="/doodle2.png"
            alt=""
            width={400}
            height={400}
            className="h-full w-full -rotate-12"
          />
        </div>
        <HeroDog />
      </div>
    </section>
  );
}

function Pitch() {
  return (
    <section className="relative bg-dream-lavender-soft pb-32 pt-32 lg:pb-40 lg:pt-40">
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 top-0 block h-[60px] w-full sm:h-[90px] lg:h-[120px]"
      >
        <path d="M 0 0 H 1440 V 30 Q 720 150 0 30 Z" fill="#f4f2ff" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 block h-[60px] w-full rotate-180 sm:h-[90px] lg:h-[120px]"
      >
        <path d="M 0 0 H 1440 V 30 Q 720 150 0 30 Z" fill="#f4f2ff" />
      </svg>

      <Image
        src="/sticker2.png"
        alt=""
        width={600}
        height={600}
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 right-4 z-20 h-auto w-[200px] rotate-[8deg] sm:-bottom-28 sm:right-10 sm:w-[260px] lg:-bottom-32 lg:right-16 lg:w-[320px]"
      />

      <div className="relative mx-auto flex max-w-[1320px] flex-col items-center px-6 text-center lg:px-10">
        <span className="font-display text-xs font-bold uppercase tracking-[0.12em] text-dream-purple">
          The Dreamhouse workshop
        </span>
        <h2 className="mt-6 font-display text-[54px] font-bold leading-[1.02] tracking-tight text-dream-ink">
          Built for your brand.
        </h2>
        <p className="mt-6 max-w-[820px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
          A small crew running art prep, screens, ink, stitches, and a quality
          check before your order leaves the building. No middlemen, no
          surprise upcharges. Just custom prints that arrive ready to wear.
        </p>
        <Link
          href="/quote"
          className="rough-pill rough-pill-outline rough-pill-lean mt-10 inline-flex items-center justify-center px-8 py-4 font-display text-base font-bold text-dream-purple transition-transform hover:-translate-y-0.5"
        >
          Get a quote
        </Link>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Methods
// ────────────────────────────────────────────────────────────────────────────

function Methods() {
  return (
    <section id="methods" className="relative mx-auto max-w-[1500px] px-6 pb-24 pt-10 lg:px-10 lg:pb-32 lg:pt-12">
      <Image
        src="/sticker3.png"
        alt=""
        width={600}
        height={600}
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -left-16 z-10 h-auto w-[160px] -rotate-[8deg] sm:-bottom-12 sm:-left-20 sm:w-[210px] lg:-bottom-16 lg:-left-28 lg:w-[260px]"
      />
      <SectionHeader
        kicker="Methods"
        cleanKicker
        title={
          <>
            Three ways to print.
          </>
        }
        subtitle="All done in-house. Pick the one that fits your job."
      />

      <div className="mt-20 flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-0">
        {METHODS.map((m, i) => (
          <article
            key={m.name}
            className={`relative h-[300px] w-full max-w-[480px] rounded-[32px] px-8 pt-7 pb-8 transition-[translate,box-shadow] duration-300 ease-out hover:z-20 hover:-translate-y-10 hover:shadow-[10px_10px_0_0_rgba(27,20,88,1)] sm:h-[340px] sm:flex-1 sm:px-9 ${i > 0 ? "sm:-ml-6" : ""} ${m.bg}`}
            style={{ rotate: `${m.rotate}deg` }}
          >
            <h3 className={`font-display text-[26px] font-bold leading-tight sm:text-[30px] ${m.titleColor}`}>
              {m.name}
            </h3>

            <Image
              src={m.image}
              alt=""
              width={260}
              height={260}
              unoptimized
              aria-hidden="true"
              className={`absolute right-2 top-[42%] z-0 h-auto -translate-y-1/2 sm:right-3 ${m.imageClassName ?? "w-[210px] sm:w-[240px]"}`}
            />

            <p className={`absolute bottom-7 left-8 right-8 z-10 max-w-[58%] text-[15px] leading-relaxed sm:left-9 sm:text-[16px] ${m.descColor}`}>
              {m.description}
            </p>
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
    <section className="bg-dream-cream pb-32 pt-20 lg:pb-44 lg:pt-24">
      <div className="mx-auto max-w-[1550px] px-6 lg:px-10">
        <SectionHeader
          kicker="Products"
          cleanKicker
          title={<>What we print on.</>}
          subtitle="The blanks we keep on hand. Ask if you don't see something."
        />

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {PRODUCT_CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              aria-label={`${cat.name}, from ${cat.startingAt}, minimum ${cat.minQty}, ${cat.turnaround}`}
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple focus-visible:ring-offset-4 focus-visible:ring-offset-dream-cream"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-[20px] bg-white ring-1 ring-dream-ink/10">
                <Image
                  src={cat.image}
                  alt=""
                  width={520}
                  height={680}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  aria-hidden="true"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-3 right-3 z-10 inline-flex items-baseline gap-1.5 rounded-full bg-white px-4 py-2 font-display text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.18)] ring-1 ring-dream-ink/10"
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-dream-ink/75">
                    from
                  </span>
                  <span className="font-display text-[17px] font-bold leading-none text-dream-purple">
                    {cat.startingAt}
                  </span>
                </span>
              </div>

              <div className="mt-5">
                <h3 className="font-display text-[22px] font-bold leading-tight tracking-tight text-dream-ink lg:text-[24px]">
                  {cat.name}
                </h3>
                <p className="mt-2 text-[13px] leading-snug text-dream-ink/70">
                  {cat.brands.join(" · ")}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-dream-ink/55">
                  {cat.turnaround} · Min {cat.minQty}
                </p>
              </div>
            </Link>
          ))}
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
    <section className="relative bg-dream-lavender-soft pb-16 pt-32 lg:pb-20 lg:pt-40">
      <svg
        aria-hidden="true"
        preserveAspectRatio="xMidYMid"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 block h-[28px] w-full"
      >
        <defs>
          <pattern
            id="services-products-scallop"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="0" rx="60" ry="28" fill="#f4f2ff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#services-products-scallop)" />
      </svg>
      <div className="relative mx-auto grid max-w-[1500px] gap-12 px-6 lg:grid-cols-[1fr_1.3fr] lg:items-start lg:gap-16 lg:px-10">
        <div>
          <h2 className="font-display text-[40px] font-bold leading-[1] tracking-tight text-dream-ink sm:text-[52px] lg:text-[64px]">
            Frequently asked questions
          </h2>
          <Image
            src="/faq.png"
            alt=""
            width={2800}
            height={1752}
            aria-hidden="true"
            className="ml-auto -mr-12 mt-20 h-auto w-[460px] sm:-mr-20 sm:w-[580px] lg:-mr-32 lg:w-[720px]"
          />
        </div>

        <div className="flex flex-col gap-3">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="faq-accordion rough-card group relative px-6 py-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-base font-bold text-dream-ink sm:text-lg">
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dream-purple font-display text-xl leading-none text-white transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-4 pr-10 text-[14px] leading-relaxed text-dream-ink-soft sm:text-[15px]">
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
// CTA, original sun-burst
// ────────────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="relative isolate overflow-hidden text-white">
      <ParallaxImage src="/cta-shirt.webp" speed={0.25} className="-z-10" />
      <div className="absolute inset-0 -z-10 bg-dream-ink/55" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-[1400px] flex-col items-center px-6 py-20 text-center lg:px-10 lg:py-24">
        <h2 className="font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl lg:text-[64px]">
          Ready when you are.
        </h2>
        <p className="mt-6 max-w-[520px] text-[15px] leading-relaxed text-white/80 sm:text-base">
          Tell us what you want and we'll come back with a real number, usually
          within a business day.
        </p>

        <div className="mt-10">
          <div
            className="sun-burst relative inline-block"
            style={{ "--ray-color": "#ecbb25" } as CSSProperties}
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
              className="relative inline-flex items-center justify-center rounded-full bg-dream-sun px-10 py-5 font-display text-lg font-bold text-dream-ink transition-transform hover:-translate-y-0.5"
            >
              Start your order
            </Link>
          </div>
        </div>

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

function SectionHeader({
  kicker,
  title,
  subtitle,
  center,
  cleanKicker,
}: {
  kicker?: string;
  title: React.ReactNode;
  subtitle?: string;
  center?: boolean;
  cleanKicker?: boolean;
}) {
  return (
    <div
      className={
        center ? "mx-auto max-w-[680px] text-center" : "max-w-[820px]"
      }
    >
      {kicker ? (
        cleanKicker ? (
          <span className="font-display text-xs font-bold uppercase tracking-[0.12em] text-dream-purple">
            {kicker}
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.28em] text-dream-purple ${
              center ? "justify-center" : ""
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-dream-purple" />
            {kicker}
          </span>
        )
      ) : null}
      <h2
        className={`${
          kicker ? "mt-4" : ""
        } font-display text-[54px] font-bold leading-[1.02] tracking-tight text-dream-ink`}
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

