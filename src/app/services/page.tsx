import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import FAQAccordion from "@/components/FAQAccordion";
import ParallaxImage from "@/components/ParallaxImage";
import Reveal from "@/components/Reveal";
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
      "Bold, long lasting prints. Best for bulk orders of tees, hoodies, and totes. Colours are the most accurate of any decoration type.",
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
      "Machine embroidery where thread is stitched into the fabric for a finish that has texture and presence. Best on thicker fabrics and with bolder details.",
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
      "Direct-to-garment (DTG) and direct-to-film (DTF) for full colour prints. Best for small runs, photos, or graphics with 8+ colours.",
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
    a: "Of course! We prefer vector files, but raster photos such as PNGs and JPEGs are great as well as long as they are high res. If they're not high res we can vectorize them for you but it does take time.",
  },
  {
    q: "What if I don't have a design?",
    a: "We don't do design in house, but we're happy to connect you with the many talented designers we know who could help you design what you need! Otherwise Canva and Adobe Express have lots of great templates you can use as well.",
  },
  {
    q: "Do you do samples?",
    a: "Yes. We can ship a blank to check fit, or quote a small pre-production run (1–5 pieces) so you see the actual print first. Prices are higher for low production runs as pricing is quantity based, but we're happy to offer re-order discounts should you wish to order more after your sample.",
  },
  {
    q: "Can I mix sizes and colours in one order?",
    a: "Absolutely! Pricing is per-unit regardless of size, although XXL and up do typically carry a surcharge.\n\nColours can be mixed and matched as long as the graphic stays the exact same, colour changes have a $25 fee per colour changed.\n\nGraphic size changes unfortunately require all new set up and we can't for example group a 3 inch graphic and 4 inch graphic together.",
  },
  {
    q: "Combine multiple products in one order?",
    a: "As long as the print is the same and viable on all products involved the quantity discount will apply to every print that is grouped!\n\nJust note that not every product or print can be grouped though. We can't always print on hats, and many shirts are not suitable for embroidery. So printing on shirts and hoodies and grouping them is great, but we probably won't be able to group your hats and shirts.\n\nOur team will let you know what can and cannot be grouped when your order is sent for approval, and we're always working on the site to make ordering easier for customers :)",
  },
  {
    q: "What if I need a revision on the mockup?",
    a: "We're always happy to adjust your order as your needs change. If you need quantity changes, a different size breakdown or want to change a product, let us know!",
  },
  {
    q: "Is there a minimum order size?",
    a: "There's no minimum order size, but pricing is quantity based and DTG and DTF are definitely preferable for small orders. We will do screen printing and embroidery for small orders, but the cost will be higher due to the set up involved.",
  },
  {
    q: "What's the quickest you can do an order?",
    a: "Typically we need at least 1 business day. Same day printing may be available if you contact us and pay before our suppliers close for the day.",
  },
  {
    q: "What's the standard order timeline?",
    a: "The standard order timeline is 10 business days. We always aim to get orders out as quick as possible though and yours may come earlier. Some suppliers are slower however, and if they are we will add time to the timeline to account for that.",
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
        <p className="mx-auto max-w-[1400px] px-6 py-2 text-center text-[15px] font-medium">
          Spring deal: 15% off orders of 50+ pieces. Submit your quote this month
        </p>
      </div>

      <BlobMorphFilter />

      <Hero />
      <Methods />

      <Products />
      <FAQ />
      <CTA />

      <SiteFooter />
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Hero — SEO-friendly H1 + description, scalloped bottom edge into Methods
// ────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative isolate flex min-h-[380px] flex-col justify-center overflow-hidden bg-dream-lavender-soft text-dream-ink md:min-h-[440px] lg:min-h-[500px]">
      <div className="relative mx-auto w-full max-w-[1400px] px-6 pb-32 pt-20 md:px-8 md:pb-40 md:pt-24 lg:px-10 lg:pb-48 lg:pt-28">
        <h1 className="max-w-[900px] font-display text-[44px] font-semibold leading-[1.05] tracking-tight text-black sm:text-[60px] md:text-[68px] lg:text-[80px]">
          Custom apparel printing in Vancouver.
        </h1>

        <p className="mt-7 max-w-[640px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
          Screen printing, embroidery, and direct-to-garment printing for
          shirts, hoodies, hats, and bags. We help local brands, small
          businesses, and teams bring their designs to life, with quality work
          and pricing that scales with your order.
        </p>
      </div>

      <svg
        aria-hidden="true"
        preserveAspectRatio="xMidYMid"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 block h-[28px] w-full"
      >
        <defs>
          <pattern
            id="services-hero-scallop"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="28" rx="60" ry="28" fill="#f4f2ff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#services-hero-scallop)" />
      </svg>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Methods (acts as the page hero — owns the H1 + primary CTA)
// ────────────────────────────────────────────────────────────────────────────

function Methods() {
  return (
    <section id="methods" className="relative mx-auto max-w-[1500px] px-6 pb-24 pt-12 lg:px-10 lg:pb-32 lg:pt-16">
      <Image
        src="/sticker3.png"
        alt=""
        width={600}
        height={600}
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -left-16 z-10 h-auto w-[160px] -rotate-[8deg] sm:-bottom-12 sm:-left-20 sm:w-[210px] lg:-bottom-16 lg:-left-28 lg:w-[260px]"
      />
      <Reveal variant="up">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-start md:gap-12 lg:gap-16">
          <h1 className="font-display text-[54px] font-bold leading-[1.02] tracking-tight text-dream-ink">
            Three ways to print custom apparel.
          </h1>
          <div>
            <p className="text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
              Screen printing, embroidery, and DTG, all done in house in
              Vancouver. Pick the method that fits your job, your timeline,
              and your budget.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                href="/quote"
                className="rough-pill rough-pill-filled rough-pill-lean inline-flex items-center justify-center px-8 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                Get a quote
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mt-20 flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-0">
        {METHODS.map((m, i) => (
          <Reveal
            key={m.name}
            variant="stamp"
            delay={i * 100}
            className={`relative h-[300px] w-full max-w-[480px] rounded-[32px] px-8 pt-7 pb-8 transition-[translate,box-shadow] duration-300 ease-out hover:z-20 hover:-translate-y-10 hover:shadow-[10px_10px_0_0_rgba(27,20,88,1)] sm:h-[340px] sm:flex-1 sm:px-9 ${i > 0 ? "sm:-ml-6" : ""} ${m.bg}`}
            style={{ rotate: `${m.rotate}deg` } as CSSProperties}
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
          </Reveal>
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
        <Reveal variant="up">
          <SectionHeader
            kicker="Products"
            cleanKicker
            title={<>What we print on.</>}
            subtitle="These are the blanks we keep on hand. If you have something else in mind, let us know. We can source many brands not listed here, and we're always adding more."
          />
        </Reveal>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 md:grid-cols-4 md:gap-6 lg:grid-cols-4 lg:gap-6">
          {PRODUCT_CATEGORIES.map((cat, i) => (
            <Reveal key={cat.name} variant="up" delay={i * 80}>
            <Link
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
            </Reveal>
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
          <Reveal variant="up">
            <h2 className="font-display text-[40px] font-bold leading-[1] tracking-tight text-dream-ink sm:text-[52px] lg:text-[64px]">
              Frequently asked questions
            </h2>
          </Reveal>
          <Reveal variant="stamp" delay={120}>
            <Image
              src="/faq.png"
              alt=""
              width={2800}
              height={1752}
              aria-hidden="true"
              className="ml-auto -mr-12 mt-20 h-auto w-[460px] sm:-mr-20 sm:w-[580px] lg:-mr-32 lg:w-[720px]"
            />
          </Reveal>
        </div>

        <FAQAccordion items={FAQS} />
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
        <Reveal variant="up">
          <h2 className="font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl md:text-[56px] lg:text-[64px]">
            Ready when you are!
          </h2>
        </Reveal>
        <Reveal variant="up" delay={80}>
          <p className="mt-6 max-w-[520px] text-[15px] leading-relaxed text-white/80 sm:text-base">
            Browse our selection below and submit an order, or if you still have questions, feel free to contact us :)
          </p>
        </Reveal>

        <div className="mt-10 flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
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

          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-full border-2 border-white px-10 py-5 font-display text-lg font-bold text-white transition-transform hover:-translate-y-0.5 hover:bg-white hover:text-dream-ink"
          >
            Contact us
          </Link>
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

