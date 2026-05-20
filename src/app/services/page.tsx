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
  imageAlt: string;
  imageTitle: string;
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
    image: "/screen-printing-vancouver.webp",
    imageAlt: "Screen printing inks and squeegee on a custom t-shirt",
    imageTitle: "Screen printing in Vancouver",
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
    image: "/custom-embroidery-vancouver.webp",
    imageAlt: "Embroidered logo thread close-up on apparel",
    imageTitle: "Custom embroidery in Vancouver",
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
    image: "/dtg-printing-vancouver.webp",
    imageAlt: "DTG printer laying ink onto a custom t-shirt",
    imageTitle: "DTG printing in Vancouver",
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
  imageAlt: string;
  imageTitle: string;
  href: string;
};

const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    name: "Shirts",
    brands: ["Gildan", "Bella+Canvas", "Comfort Colors"],
    startingAt: "$12",
    minQty: 25,
    turnaround: "7–10 days",
    image: "/products/custom-t-shirts-vancouver.jpg",
    imageAlt: "Custom screen-printed t-shirt",
    imageTitle: "Custom t shirts in Vancouver",
    href: "/quote?product=shirt",
  },
  {
    name: "Hoodies",
    brands: ["Gildan", "Bella+Canvas", "Independent"],
    startingAt: "$32",
    minQty: 25,
    turnaround: "7–10 days",
    image: "/products/custom-hoodies-vancouver.jpg",
    imageAlt: "Custom printed hoodie folded on a shelf",
    imageTitle: "Custom hoodies in Vancouver",
    href: "/quote?product=hoodie",
  },
  {
    name: "Hats & toques",
    brands: ["Flexfit", "Richardson", "Yupoong"],
    startingAt: "$18",
    minQty: 24,
    turnaround: "10–14 days",
    image: "/products/custom-hats-vancouver.jpg",
    imageAlt: "Custom embroidered cap",
    imageTitle: "Custom hats and toques in Vancouver",
    href: "/quote?product=hat",
  },
  {
    name: "Bags & totes",
    brands: ["Liberty Bags", "BAGedge", "Port Authority"],
    startingAt: "$14",
    minQty: 25,
    turnaround: "7–10 days",
    image: "/products/custom-tote-bags-vancouver.jpg",
    imageAlt: "Custom printed canvas tote bag",
    imageTitle: "Custom tote bags in Vancouver",
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

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-dream-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>

      <div className="hidden bg-[#c6ff3d] text-[#8f55e5] sm:block">
        <p className="mx-auto max-w-[1400px] whitespace-nowrap px-4 py-2 text-center text-[12px] font-bold sm:whitespace-normal sm:px-6 sm:text-[15px]">
          <span className="hidden sm:inline">
            We price match Coastal Reign and Get Bold! Submit a request and we&apos;ll{" "}
            <span className="font-display font-extrabold uppercase tracking-wide">beat it by 5%</span>
          </span>
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
    <section className="relative isolate overflow-hidden bg-dream-lavender-soft text-dream-ink">
      <div className="relative mx-auto w-full max-w-[1450px] px-6 pb-24 pt-12 md:px-8 md:pb-32 md:pt-24 lg:px-10 lg:pb-36 lg:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(360px,540px)] lg:gap-12">
          <div>
            <h1 className="max-w-[1100px] font-display text-[44px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[52px] md:text-[64px] lg:text-[76px]">
              Custom apparel{" "}
              <span className="lg:block xl:whitespace-nowrap">
                printing in Vancouver<span className="hidden md:inline">.</span>
              </span>
            </h1>

            <p className="mt-7 max-w-[640px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
              Custom screen printing, embroidery, and direct-to-garment in
              Vancouver for shirts, hoodies, hats, and bags. Built for local
              brands, small businesses, and teams.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[480px] pb-10 pr-6 lg:mx-0 lg:max-w-none lg:pb-14 lg:pr-10">
            <Image
              src="/sticker2.png"
              alt=""
              aria-hidden="true"
              width={400}
              height={400}
              className="pointer-events-none absolute -right-6 -top-10 z-0 h-auto w-[140px] -rotate-12 sm:-right-10 sm:-top-14 sm:w-[180px] lg:-right-14 lg:-top-16 lg:w-[210px]"
            />

            <div className="relative z-10 -rotate-[2deg] rounded-xl bg-white p-2.5 shadow-[8px_8px_0_0_rgba(27,20,88,1)]">
              <div className="relative aspect-square overflow-hidden rounded-lg">
                <Image
                  src="/custom-screen-printed-tshirts-vancouver.webp"
                  alt="Couple wearing matching custom screen-printed t-shirts in Vancouver"
                  title="Custom screen-printed t-shirts in Vancouver"
                  fill
                  priority
                  sizes="(min-width: 1024px) 480px, (min-width: 640px) 420px, 100vw"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="absolute -bottom-8 right-0 z-20 w-[48%] rotate-[7deg] rounded-lg bg-white p-2 shadow-[6px_6px_0_0_rgba(27,20,88,0.95)] sm:-bottom-6 sm:right-2 lg:right-4">
              <div className="relative aspect-square overflow-hidden rounded-md">
                <Image
                  src="/custom-printed-brand-merch-vancouver.webp"
                  alt="Custom screen-printed brand merch t-shirts on hangers"
                  title="Custom printed brand merch in Vancouver"
                  fill
                  sizes="(min-width: 1024px) 220px, (min-width: 640px) 195px, 45vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
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
    <section id="methods" className="relative mx-auto max-w-[1500px] px-6 pb-24 pt-20 lg:px-10 lg:pb-32 lg:pt-28">
      <Image
        src="/sticker3.png"
        alt=""
        width={600}
        height={600}
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -left-16 z-10 h-auto w-[160px] -rotate-[8deg] sm:-bottom-12 sm:-left-20 sm:w-[210px] lg:-bottom-16 lg:-left-28 lg:w-[260px]"
      />
      <Reveal variant="up">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start lg:gap-16">
          <h2 className="font-display text-[38px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[38px] lg:text-[46px]">
            Three ways to print custom apparel in Vancouver<span className="hidden lg:inline">.</span>
          </h2>
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

      <div className="mt-20 flex flex-col items-center gap-4 lg:flex-row lg:flex-wrap lg:justify-center lg:gap-0">
        {METHODS.map((m, i) => (
          <Reveal
            key={m.name}
            variant="stamp"
            delay={i * 100}
            className={`relative h-[300px] w-full max-w-[480px] rounded-[32px] px-8 pt-7 pb-8 transition-[translate,box-shadow] duration-300 ease-out hover:z-20 hover:-translate-y-10 hover:shadow-[10px_10px_0_0_rgba(27,20,88,1)] sm:h-[340px] sm:px-9 lg:flex-1 ${i > 0 ? "lg:-ml-6" : ""} ${m.bg}`}
            style={{ rotate: `${m.rotate}deg` } as CSSProperties}
          >
            <h3 className={`font-display text-[26px] font-bold leading-tight sm:text-[30px] ${m.titleColor}`}>
              {m.name}
            </h3>

            <Image
              src={m.image}
              alt={m.imageAlt}
              title={m.imageTitle}
              width={260}
              height={260}
              unoptimized
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
            center
            title={<>What we print on<span className="hidden lg:inline">.</span></>}
            subtitle="These are the blanks we keep on hand. If you have something else in mind, let us know. We can source many brands not listed here, and we're always adding more."
          />
        </Reveal>

        <div className="mt-14 grid gap-y-14 gap-x-8 sm:grid-cols-2 sm:gap-y-16 lg:grid-cols-4 lg:gap-x-6">
          {PRODUCT_CATEGORIES.map((cat, i) => {
            const tagTilts = [6, -7, 5, -6];
            return (
            <Reveal key={cat.name} variant="up" delay={i * 80}>
            <Link
              href={cat.href}
              aria-label={`${cat.name}, from ${cat.startingAt}, minimum ${cat.minQty}, ${cat.turnaround}`}
              className="group relative block focus-visible:outline-none"
            >
              <div
                className="relative aspect-[5/4] overflow-hidden rounded-[22px] bg-dream-cream shadow-[6px_6px_0_0_rgba(27,20,88,0.92)] ring-1 ring-dream-ink/15 transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[10px_12px_0_0_rgba(27,20,88,1)] group-focus-visible:ring-2 group-focus-visible:ring-dream-purple sm:aspect-[3/4]"
              >
                <Image
                  src={cat.image}
                  alt={cat.imageAlt}
                  title={cat.imageTitle}
                  width={520}
                  height={680}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                />
              </div>

              <span
                aria-hidden="true"
                className="price-tag-alive pointer-events-none absolute -right-2 top-4 z-20 inline-flex items-baseline gap-1.5 rounded-full bg-dream-sun px-4 py-2 font-display text-dream-ink shadow-[0_3px_0_0_rgba(27,20,88,0.92)] ring-2 ring-white"
                style={{ "--base-tilt": `${tagTilts[i % tagTilts.length]}deg` } as CSSProperties}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-dream-ink/70">
                  from
                </span>
                <span className="font-display text-[17px] font-bold leading-none text-dream-ink">
                  {cat.startingAt}
                </span>
              </span>

              <div className="mt-5 flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <h3 className="font-display text-[22px] font-bold leading-tight tracking-tight text-dream-ink lg:text-[24px]">
                    {cat.name}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-snug text-dream-ink/70">
                    {cat.brands.join(" · ")}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 flex-shrink-0 -translate-x-3 -rotate-45 scale-0 items-center justify-center rounded-full bg-dream-ink text-white opacity-0 shadow-[0_2px_0_0_rgba(27,20,88,0.95)] transition-all duration-500 ease-[cubic-bezier(0.34,1.6,0.5,1)] group-hover:translate-x-0 group-hover:rotate-0 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:rotate-0 group-focus-visible:scale-100 group-focus-visible:opacity-100"
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3 transition-transform duration-700 ease-out group-hover:translate-x-0.5" aria-hidden="true">
                    <path d="M3 8 H13 M9 4 L13 8 L9 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[12px] font-medium text-dream-ink/55">
                <span className="inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 4.5 V8 L10.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {cat.turnaround}
                </span>
                <span aria-hidden="true" className="text-dream-ink/30">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                    <path d="M2.5 5.5 L8 3 L13.5 5.5 L8 8 Z M2.5 5.5 V11 L8 13.5 M13.5 5.5 V11 L8 13.5 M8 8 V13.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                  Min {cat.minQty}
                </span>
              </div>
            </Link>
            </Reveal>
            );
          })}
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
    <section id="faq" className="relative bg-dream-lavender-soft pb-16 pt-32 lg:pb-20 lg:pt-40 scroll-mt-24">
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
      <div className="relative mx-auto grid max-w-[1500px] gap-4 px-6 lg:grid-cols-[1fr_1.3fr] lg:items-start lg:gap-16 lg:px-10">
        <div>
          <Reveal variant="up">
            <h2 className="font-display text-[38px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[38px] md:text-[44px] lg:text-[48px]">
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
              className="ml-auto -mr-20 mt-4 h-auto w-[460px] sm:-mr-28 sm:mt-12 sm:w-[580px] lg:-mr-48 lg:mt-20 lg:w-[720px]"
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
      <ParallaxImage src="/custom-t-shirt-printing-vancouver.webp" speed={0.25} className="-z-10" />
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
        } font-display text-[38px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[38px] lg:text-[46px]`}
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

