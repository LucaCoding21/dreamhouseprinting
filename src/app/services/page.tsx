"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

// ────────────────────────────────────────────────────────────────────────────
// Content
// ────────────────────────────────────────────────────────────────────────────

type Method = {
  name: string;
  tagline: string;
  tags: string[];
  blob: string;
  blobWidth: number;
  blobHeight: number;
  dog: string;
  dogWidth: string;
  variant: "ink" | "thread";
};

const METHODS: Method[] = [
  {
    name: "Screen printing",
    tagline: "Ink on cotton.",
    tags: ["bulk runs", "bold colour", "25+ min"],
    blob: "/how it works/1blob.svg",
    blobWidth: 255,
    blobHeight: 310,
    dog: "/how it works/step1.apng",
    dogWidth: "70%",
    variant: "ink",
  },
  {
    name: "Embroidery",
    tagline: "Thread in fibre.",
    tags: ["premium feel", "raised stitch", "12+ min"],
    blob: "/how it works/2blob.svg",
    blobWidth: 317,
    blobHeight: 255,
    dog: "/how it works/step2.apng",
    dogWidth: "82%",
    variant: "thread",
  },
];

type ProductCategory = {
  name: string;
  brands: string[];
  methods: string[];
  startingAt: string;
  tagTilt: number;
  image: string;
  blob: string;
  blobWidth: number;
  blobHeight: number;
  imageWidth: string;
  href: string;
};

const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    name: "Shirts",
    brands: ["Gildan", "Bella+Canvas", "Comfort Colors", "Next Level"],
    methods: ["Screen printing", "Embroidery"],
    startingAt: "$12",
    tagTilt: -6,
    image: "/shopbycategories/shirtcategory.webp",
    blob: "/shopbycategories/shirtblob.svg",
    blobWidth: 333,
    blobHeight: 267,
    imageWidth: "58%",
    href: "/quote?product=shirt",
  },
  {
    name: "Hoodies",
    brands: ["Gildan", "Bella+Canvas", "Independent", "Comfort Colors"],
    methods: ["Screen printing", "Embroidery"],
    startingAt: "$32",
    tagTilt: 5,
    image: "/shopbycategories/hoodiecategory.webp",
    blob: "/shopbycategories/hoodieblob.svg",
    blobWidth: 360,
    blobHeight: 284,
    imageWidth: "60%",
    href: "/quote?product=hoodie",
  },
  {
    name: "Hats & toques",
    brands: ["Flexfit", "Richardson", "Yupoong"],
    methods: ["Embroidery", "Screen printing"],
    startingAt: "$18",
    tagTilt: -4,
    image: "/shopbycategories/hatcategory.webp",
    blob: "/shopbycategories/hatblob.svg",
    blobWidth: 357,
    blobHeight: 288,
    imageWidth: "66%",
    href: "/quote?product=hat",
  },
  {
    name: "Bags & totes",
    brands: ["Liberty Bags", "BAGedge", "Port Authority"],
    methods: ["Screen printing"],
    startingAt: "$14",
    tagTilt: 6,
    image: "/shopbycategories/bagscategory.webp",
    blob: "/shopbycategories/bagsblob.svg",
    blobWidth: 358,
    blobHeight: 269,
    imageWidth: "54%",
    href: "/quote?product=bag",
  },
];

const PRICING_FACTORS = [
  {
    title: "Quantity",
    body: "The single biggest lever. 50 shirts costs meaningfully less per-unit than 25. At 250+ the price gets noticeably better again.",
  },
  {
    title: "Print colours",
    body: "Each colour is its own screen, which means its own setup. A 1-colour design is cheapest; a 4-colour design is where costs climb.",
  },
  {
    title: "Print locations",
    body: "Front-only is the baseline. Adding a back or sleeve print adds a run. Roughly a 30–60% bump in print cost per extra spot.",
  },
  {
    title: "Garment choice",
    body: "A Gildan 5000 tee is our baseline blank. A Bella+Canvas Airlume or a Comfort Colors garment-dye costs more but feels it.",
  },
];

type Tier = {
  range: string;
  price: string;
  note?: string;
};

const VOLUME_TIERS: Tier[] = [
  { range: "25–49 units", price: "$12" },
  { range: "50–99 units", price: "$10" },
  { range: "100–249 units", price: "$8" },
  { range: "250+ units", price: "$6", note: "best value" },
];

type LogisticsItem = {
  title: string;
  body: string;
  icon: "min" | "calendar" | "bolt" | "box";
};

const LOGISTICS: LogisticsItem[] = [
  {
    title: "Minimum order",
    body: "25 units for screen printing, 12 for embroidery. Smaller runs are possible. The per-unit math just gets tougher.",
    icon: "min",
  },
  {
    title: "Standard turnaround",
    body: "10–14 business days from artwork approval. We don't start printing until you've signed off on the mockup.",
    icon: "calendar",
  },
  {
    title: "Rush option",
    body: "5–7 business days with a +25% rush fee (when we have capacity). Ask early; calendar fills 2–3 weeks out.",
    icon: "bolt",
  },
  {
    title: "Pickup & shipping",
    body: "Free pickup in Vancouver. Canada-wide shipping via Canada Post, typically $18–40 depending on volume.",
    icon: "box",
  },
];

const FAQS = [
  {
    q: "Can I use my own artwork?",
    a: "Yes. Send vector files (.ai, .eps, .pdf) or a high-res .png at 300dpi. If you only have a low-res JPEG off someone's phone, we'll help clean it up (small charge may apply).",
  },
  {
    q: "What if I don't have a design?",
    a: "We can work from a sketch, a rough idea, or a reference image. We'll either design it in-house or connect you with one of the designers we trust. Either way, you'll see a mockup before anything gets printed.",
  },
  {
    q: "Do you do samples?",
    a: "Yes. We can ship a blank garment so you can check fit and feel, or quote a small pre-production run (usually 3–5 pieces) if you want to see the actual print first.",
  },
  {
    q: "Can I mix sizes in one order?",
    a: "Absolutely. Pricing is per-unit regardless of size, except 2XL and up carry a small garment upcharge of $2–4 depending on the product.",
  },
  {
    q: "Can I combine multiple products in one order?",
    a: "Yes, but minimums apply per product type. 25 shirts + 25 hoodies is two runs' worth of setup, so it prices like two jobs rather than one combined 50-piece order.",
  },
  {
    q: "What if I need a revision on the mockup?",
    a: "Revisions are free and expected. We don't hit print until you're happy. Most orders go through 1–2 rounds of tweaks before approval.",
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Shared decorative bits
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
      className={`gsap-scribble absolute left-0 right-0 h-[12px] w-full ${className}`}
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

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      const container = containerRef.current;

      // ── Scribble draw-on helper ──────────────────────────────────
      const setScribble = (path: SVGPathElement) => {
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      };

      // ── Hero intro (no scroll trigger; runs on mount) ────────────
      gsap.from(".gsap-hero-h1", {
        y: 32,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
      });
      gsap.from(".gsap-hero-sub", {
        y: 20,
        opacity: 0,
        duration: 0.7,
        delay: 0.25,
        ease: "power3.out",
      });
      gsap.from(".gsap-hero-visual", {
        scale: 0.82,
        opacity: 0,
        duration: 1.1,
        delay: 0.3,
        ease: "elastic.out(1, 0.7)",
      });

      const heroScribbles = container.querySelectorAll<SVGPathElement>(
        ".gsap-hero-area .gsap-scribble path"
      );
      heroScribbles.forEach(setScribble);
      gsap.to(heroScribbles, {
        strokeDashoffset: 0,
        duration: 0.85,
        delay: 0.7,
        stagger: 0.15,
        ease: "power2.inOut",
      });

      // ── Section header reveals ───────────────────────────────────
      gsap.utils
        .toArray<HTMLElement>(".gsap-section-header")
        .forEach((el) => {
          const scribbles = el.querySelectorAll<SVGPathElement>(
            ".gsap-scribble path"
          );
          scribbles.forEach(setScribble);

          gsap.from(el.children, {
            y: 26,
            opacity: 0,
            duration: 0.75,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%" },
          });
          gsap.to(scribbles, {
            strokeDashoffset: 0,
            duration: 0.85,
            ease: "power2.inOut",
            scrollTrigger: { trigger: el, start: "top 80%" },
          });
        });

      // ── Method tiles ─────────────────────────────────────────────
      gsap.utils
        .toArray<HTMLElement>(".gsap-method-tile")
        .forEach((tile, i) => {
          gsap.from(tile, {
            y: 60,
            opacity: 0,
            scale: 0.95,
            duration: 0.9,
            ease: "back.out(1.4)",
            delay: i * 0.1,
            scrollTrigger: { trigger: tile, start: "top 85%" },
          });
          gsap.from(tile.querySelectorAll(".gsap-tile-pill"), {
            y: 14,
            scale: 0.6,
            opacity: 0,
            duration: 0.55,
            stagger: 0.08,
            delay: 0.4 + i * 0.1,
            ease: "back.out(1.7)",
            scrollTrigger: { trigger: tile, start: "top 80%" },
          });
        });

      // ── Product / category cards ─────────────────────────────────
      gsap.utils
        .toArray<HTMLElement>(".gsap-product-card")
        .forEach((card, i) => {
          gsap.from(card, {
            y: 40,
            opacity: 0,
            duration: 0.75,
            ease: "back.out(1.3)",
            delay: (i % 4) * 0.08,
            scrollTrigger: { trigger: card, start: "top 90%" },
          });
        });

      // ── Pricing factor cards ─────────────────────────────────────
      gsap.utils
        .toArray<HTMLElement>(".gsap-pricing-card")
        .forEach((card, i) => {
          gsap.from(card, {
            y: 30,
            opacity: 0,
            duration: 0.7,
            ease: "back.out(1.4)",
            delay: (i % 4) * 0.1,
            scrollTrigger: { trigger: card, start: "top 90%" },
          });
        });

      // ── Volume tier "staircase" — descend left to right ──────────
      gsap.utils
        .toArray<HTMLElement>(".gsap-tier-card")
        .forEach((card, i) => {
          gsap.from(card, {
            x: -16,
            y: -28,
            opacity: 0,
            duration: 0.7,
            ease: "back.out(1.5)",
            delay: i * 0.12,
            scrollTrigger: { trigger: card, start: "top 90%" },
          });
        });

      // ── Logistics cards ──────────────────────────────────────────
      gsap.utils
        .toArray<HTMLElement>(".gsap-logistics-card")
        .forEach((card, i) => {
          gsap.from(card, {
            y: 26,
            scale: 0.92,
            opacity: 0,
            duration: 0.7,
            ease: "back.out(1.5)",
            delay: (i % 4) * 0.08,
            scrollTrigger: { trigger: card, start: "top 90%" },
          });
        });

      // ── FAQ items ────────────────────────────────────────────────
      gsap.utils.toArray<HTMLElement>(".gsap-faq-item").forEach((item, i) => {
        gsap.from(item, {
          x: -18,
          opacity: 0,
          duration: 0.55,
          ease: "power3.out",
          delay: i * 0.05,
          scrollTrigger: { trigger: item, start: "top 92%" },
        });
      });

      // ── CTA section ──────────────────────────────────────────────
      gsap.from(".gsap-cta-pill", {
        scale: 0.82,
        opacity: 0,
        duration: 0.85,
        ease: "elastic.out(1, 0.7)",
        scrollTrigger: { trigger: ".gsap-cta-section", start: "top 75%" },
      });
      gsap.from(".gsap-cta-ray", {
        width: 0,
        opacity: 0,
        duration: 0.5,
        stagger: 0.04,
        ease: "back.out(1.7)",
        scrollTrigger: { trigger: ".gsap-cta-section", start: "top 75%" },
      });
    },
    { scope: containerRef }
  );

  // Cursor-follow gaze on the hero dog (mountain trick from the article)
  useEffect(() => {
    const heroEl = containerRef.current?.querySelector<HTMLElement>(
      ".gsap-hero-visual"
    );
    const heroDog = containerRef.current?.querySelector<HTMLElement>(
      ".gsap-hero-dog"
    );
    if (!heroEl || !heroDog) return;

    const xTo = gsap.quickTo(heroDog, "x", {
      duration: 0.6,
      ease: "power3.out",
    });
    const yTo = gsap.quickTo(heroDog, "y", {
      duration: 0.6,
      ease: "power3.out",
    });
    const onMove = (e: MouseEvent) => {
      const rect = heroEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const max = 14;
      xTo(((e.clientX - cx) / rect.width) * max);
      yTo(((e.clientY - cy) / rect.height) * max);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <main ref={containerRef} className="min-h-screen bg-dream-cream">
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>

      <BlobMorphFilter />

      <HeroSection />
      <PrintMethodsSection />
      <ProductsSection />
      <PricingSection />
      <LogisticsSection />
      <FAQSection />
      <BottomCTA />

      <SiteFooter />
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sections
// ────────────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="gsap-hero-area relative overflow-hidden">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-6 pb-10 pt-10 lg:grid-cols-[1.4fr_1fr] lg:px-10 lg:pb-14 lg:pt-16">
        <div>
          <h1 className="gsap-hero-h1 font-display text-4xl font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-5xl lg:text-[68px]">
            What we{" "}
            <span className="relative inline-block">
              print
              <ScribbleUnderline className="-bottom-1 lg:-bottom-2" />
            </span>
            <br className="hidden sm:block" /> &amp; how we{" "}
            <span className="relative inline-block">
              print it.
              <ScribbleUnderline className="-bottom-1 lg:-bottom-2" />
            </span>
          </h1>
          <p className="gsap-hero-sub mt-6 max-w-[560px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
            Everything you need to know before you send over your design. The
            print methods we offer, the products they work on, and how pricing
            actually works.
          </p>
        </div>

        <div className="gsap-hero-visual relative mx-auto w-full max-w-[380px] lg:max-w-none">
          <div className="relative flex aspect-square items-center justify-center">
            <Image
              src="/how it works/1blob.svg"
              alt=""
              width={255}
              height={310}
              className="blob-morph absolute inset-0 m-auto h-full w-full object-contain"
              aria-hidden="true"
            />
            <Image
              src="/how it works/step1.apng"
              alt=""
              width={460}
              height={460}
              unoptimized
              className="gsap-hero-dog relative z-10 h-auto w-[95%]"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PrintMethodsSection() {
  return (
    <section className="relative mx-auto max-w-[1400px] px-6 pb-20 pt-8 lg:px-10 lg:pb-24 lg:pt-10">
      <SectionHeader
        title={
          <>
            How we{" "}
            <span className="relative inline-block">
              do it
              <ScribbleUnderline className="-bottom-1" />
            </span>
            .
          </>
        }
        subtitle="Two ways your design ends up on the garment. Same craft, different approach."
      />

      <div className="mt-14 grid gap-7 lg:grid-cols-2 lg:gap-9">
        {METHODS.map((method) => (
          <MethodTile key={method.name} method={method} />
        ))}
      </div>
    </section>
  );
}

function MethodTile({ method }: { method: Method }) {
  const isInk = method.variant === "ink";
  const tilePalette = isInk
    ? {
        bg: "#1b1458",
        fg: "#fffaf0",
        pillBg: "rgba(255,250,240,0.12)",
        pillFg: "#fffaf0",
        taglineOpacity: 0.7,
        backgroundImage:
          "radial-gradient(rgba(255,250,240,0.08) 1.2px, transparent 1.2px)",
        backgroundSize: "12px 12px",
      }
    : {
        bg: "#ece5ff",
        fg: "#1b1458",
        pillBg: "rgba(255,255,255,0.7)",
        pillFg: "#1b1458",
        taglineOpacity: 0.65,
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(27,20,88,0.07) 0 1px, transparent 1px 10px), repeating-linear-gradient(-45deg, rgba(27,20,88,0.07) 0 1px, transparent 1px 10px)",
        backgroundSize: "auto",
      };

  return (
    <article
      className="gsap-method-tile group relative flex flex-col overflow-hidden rounded-[32px]"
      style={{
        backgroundColor: tilePalette.bg,
        color: tilePalette.fg,
        backgroundImage: tilePalette.backgroundImage,
        backgroundSize: tilePalette.backgroundSize,
        boxShadow: "0 6px 0 0 rgba(27,20,88,0.18)",
      }}
    >
      <div className="relative flex aspect-[5/4] items-center justify-center px-6 pt-8 sm:px-8 sm:pt-10">
        <Image
          src={method.blob}
          alt=""
          width={method.blobWidth}
          height={method.blobHeight}
          className="blob-morph absolute inset-0 m-auto h-[72%] w-[72%] object-contain transition-transform duration-[600ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110"
          aria-hidden="true"
          style={{ opacity: isInk ? 0.32 : 1 }}
        />
        <Image
          src={method.dog}
          alt=""
          width={460}
          height={460}
          unoptimized
          className="relative z-10 h-auto origin-bottom transition-transform duration-[600ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-rotate-3 group-hover:scale-[1.06]"
          style={{ width: method.dogWidth }}
          aria-hidden="true"
        />
      </div>

      <div className="px-7 pb-9 pt-2 sm:px-9 sm:pb-10">
        <h3 className="font-display text-[40px] font-bold leading-[1.02] tracking-tight sm:text-[48px]">
          {method.name}.
        </h3>
        <p
          className="mt-3 font-display text-[19px] italic sm:text-xl"
          style={{ opacity: tilePalette.taglineOpacity }}
        >
          {method.tagline}
        </p>

        <div className="mt-7 flex flex-wrap gap-2.5">
          {method.tags.map((tag) => (
            <span
              key={tag}
              className="gsap-tile-pill inline-flex items-center rounded-full px-3.5 py-1.5 font-display text-[12px] font-bold uppercase tracking-[0.18em] transition-transform duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-0.5"
              style={{
                backgroundColor: tilePalette.pillBg,
                color: tilePalette.pillFg,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function ProductsSection() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10 lg:py-20">
      <SectionHeader
        title={
          <>
            Pick a{" "}
            <span className="relative inline-block">
              category
              <ScribbleUnderline className="-bottom-1" />
            </span>
            , we handle the rest.
          </>
        }
        subtitle="The blanks we keep on hand, the print methods they take, and a rough starting price so you can ballpark before you ask."
      />

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCT_CATEGORIES.map((cat) => (
          <Link
            key={cat.name}
            href={cat.href}
            className="gsap-product-card group rough-card relative flex flex-col px-5 pb-6 pt-5 transition hover:-translate-y-1"
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

            <div className="mt-4 flex flex-col gap-3.5">
              <h3 className="font-display text-xl font-bold text-dream-ink">
                {cat.name}
              </h3>

              <div>
                <div className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-dream-ink/50">
                  Brands
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cat.brands.map((b, j) => (
                    <span
                      key={b}
                      className="inline-flex items-center rounded-[6px] border-2 border-dream-ink/15 bg-white px-2 py-[3px] font-display text-[11px] font-bold text-dream-ink shadow-[0_1.5px_0_0_rgba(27,20,88,0.12)]"
                      style={{
                        transform: `rotate(${[-1.5, 1, -0.5, 1.5][j % 4]}deg)`,
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-dream-ink/50">
                  Works with
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cat.methods.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dream-purple/25 bg-dream-lavender-soft/60 px-2.5 py-0.5 font-display text-[11px] font-semibold text-dream-purple"
                    >
                      <span className="h-1 w-1 rounded-full bg-dream-purple" />
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section className="bg-dream-lavender-soft">
      <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10 lg:py-24">
        <SectionHeader
          kicker="How pricing works"
          title={
            <>
              Four things move the{" "}
              <span className="relative inline-block">
                price
                <ScribbleUnderline className="-bottom-1" />
              </span>
              . That's it.
            </>
          }
          subtitle="No public calculator (yet) because the real number always depends on specifics. But here's the logic, so you can estimate before you ask."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING_FACTORS.map((factor, i) => (
            <div
              key={factor.title}
              className="gsap-pricing-card rough-card relative px-6 py-7"
            >
              <NumberCircle n={i + 1} />
              <h3 className="mt-4 font-display text-lg font-bold text-dream-ink">
                {factor.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-dream-ink-soft">
                {factor.body}
              </p>
            </div>
          ))}
        </div>

        {/* Volume tier staircase — each step gets lower as price drops. */}
        <div className="rough-card relative mt-16 px-7 pb-9 pt-8 lg:px-12 lg:pb-12 lg:pt-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold text-dream-ink sm:text-3xl lg:text-4xl">
                More you order, less it costs.
              </h3>
              <p className="mt-3 max-w-[520px] text-[14px] text-dream-ink-soft">
                Example: 1-colour front print on a standard Gildan tee. Your
                real quote will differ, the slope won't.
              </p>
            </div>
            <span className="inline-flex shrink-0 -rotate-2 items-center gap-2 self-start rounded-full bg-dream-sun px-3.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-dream-ink shadow-[0_3px_0_0_rgba(27,20,88,0.15)]">
              Example · Not a quote
            </span>
          </div>

          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VOLUME_TIERS.map((tier) => {
              const isBest = Boolean(tier.note);
              return (
                <li
                  key={tier.range}
                  className={`gsap-tier-card relative flex flex-col rounded-2xl border-2 bg-white px-5 py-5 ${
                    isBest
                      ? "border-dream-purple"
                      : "border-dream-ink/10"
                  }`}
                >
                  {isBest ? (
                    <span className="absolute -top-2.5 right-4 inline-flex items-center rounded-full bg-dream-purple px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      {tier.note}
                    </span>
                  ) : null}

                  <div className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-dream-ink/50">
                    Quantity
                  </div>
                  <div className="mt-1 font-display text-[14px] font-semibold text-dream-ink">
                    {tier.range}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="font-display text-[34px] font-bold leading-none text-dream-ink">
                      {tier.price}
                    </span>
                    <span className="font-display text-[12px] font-semibold text-dream-ink-soft">
                      /unit
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function LogisticsSection() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10 lg:py-24">
      <SectionHeader
        kicker="Minimums & turnaround"
        title={
          <>
            The{" "}
            <span className="relative inline-block">
              practical stuff
              <ScribbleUnderline className="-bottom-1" />
            </span>
            , up front.
          </>
        }
        subtitle="Nobody likes finding out about minimums and timelines at the end of the form. Here it is first."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {LOGISTICS.map((item, i) => (
          <div
            key={item.title}
            className="gsap-logistics-card rough-card relative px-6 py-7"
            style={{ transform: `rotate(${[-0.8, 0.6, -0.4, 0.8][i]}deg)` }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-dream-lavender-soft text-dream-purple">
              <LogisticsIcon name={item.icon} />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-dream-ink">
              {item.title}
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-dream-ink-soft">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section className="bg-dream-lavender-soft">
      <div className="mx-auto max-w-[900px] px-6 py-16 lg:px-10 lg:py-24">
        <SectionHeader
          kicker="FAQ"
          title={
            <>
              Things people{" "}
              <span className="relative inline-block">
                ask
                <ScribbleUnderline className="-bottom-1" />
              </span>{" "}
              before they ask.
            </>
          }
          center
        />

        <div className="mt-12 flex flex-col gap-4">
          {FAQS.map((item, i) => (
            <details
              key={item.q}
              className="gsap-faq-item group rough-card relative px-6 py-5"
              style={{ transform: `rotate(${i % 2 === 0 ? -0.3 : 0.3}deg)` }}
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

// 12 sun rays around the CTA pill.
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

function BottomCTA() {
  return (
    <section className="gsap-cta-section relative bg-dream-purple text-white">
      {/* Dog mascot leaning into the section from the top. */}
      <div className="pointer-events-none absolute left-8 -top-[120px] hidden lg:block">
        <Image
          src="/how it works/3dog.png"
          alt=""
          width={240}
          height={240}
          className="h-auto w-[200px] rotate-[-6deg]"
          aria-hidden="true"
        />
      </div>

      <div className="mx-auto flex max-w-[1400px] flex-col items-center px-6 py-20 text-center lg:px-10 lg:py-28">
        <span className="inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.28em] text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
          Let's go
        </span>
        <h2 className="mt-4 font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl lg:text-[72px]">
          Ready when{" "}
          <span className="relative inline-block">
            you are.
            <ScribbleUnderline className="-bottom-1 lg:-bottom-2" />
          </span>
        </h2>
        <p className="mt-6 max-w-[520px] text-[15px] leading-relaxed text-white/80 sm:text-base">
          You've got the context. Tell us what you want and we'll come back
          with a real number, usually within a business day.
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
                className="gsap-cta-ray sun-ray"
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
              className="gsap-cta-pill rough-pill rough-pill-white rough-pill-lean relative inline-flex items-center justify-center px-10 py-5 font-display text-lg font-bold text-dream-ink transition-transform hover:-translate-y-0.5"
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
      className={`gsap-section-header ${
        center ? "mx-auto max-w-[680px] text-center" : "max-w-[780px]"
      }`}
    >
      {kicker ? (
        <span className="inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.28em] text-dream-purple">
          <span className="h-1.5 w-1.5 rounded-full bg-dream-purple" />
          {kicker}
        </span>
      ) : null}
      <h2 className={`${kicker ? "mt-4" : ""} font-display text-3xl font-bold leading-[1.05] tracking-tight text-dream-ink sm:text-4xl lg:text-[48px]`}>
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-5 text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function LogisticsIcon({
  name,
}: {
  name: "min" | "calendar" | "bolt" | "box";
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true,
  };
  switch (name) {
    case "min":
      // Stacked tally — three short bars, bottom one longer (represents volume).
      return (
        <svg {...common}>
          <path d="M6 7h8" />
          <path d="M6 12h12" />
          <path d="M4 17h16" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17" />
          <path d="M8 3.5v3" />
          <path d="M16 3.5v3" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 3 L5 13.5 h6 L11 21 l8-10.5 h-6 L13 3Z" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
          <path d="M3.5 7.5 12 12l8.5-4.5" />
          <path d="M12 12v9" />
        </svg>
      );
  }
}

