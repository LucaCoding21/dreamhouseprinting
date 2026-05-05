import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import ParallaxScroll from "@/components/ParallaxScroll";
import PolaroidPhoto from "@/components/PolaroidPhoto";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

// 12 sun rays around the hero CTA pill — same recipe used elsewhere on the site.
const HERO_CTA_RAYS = Array.from({ length: 12 }, (_, i) => {
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

const SERVICES = [
  {
    name: "Screen printing",
    body: "Each color is a separate screen, hand-pulled across the fabric. The ink lays thick and stays vibrant wash after wash.",
    bestFor: "Best for bulk runs and bold colors",
    image: "/products/shirts.jpg",
    href: "/services#methods",
  },
  {
    name: "Embroidery",
    body: "Your artwork is digitized into stitch paths and run on commercial machines, so logos sit raised and crisp against the garment.",
    bestFor: "Best for logos and premium pieces",
    image: "/products/hoodies.jpg",
    href: "/services#methods",
  },
  {
    name: "DTG printing",
    body: "Inkjet printed straight onto the shirt. Perfect for full-color or photographic artwork without the screen setup costs.",
    bestFor: "Best for photo prints and small runs",
    image: "/products/hats2.jpg",
    href: "/services#methods",
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-dream-cream">
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>

      <Hero />
      <WhatWeDo />
      <BoldStatement />
      <Services />

      <SiteFooter />
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Hero — flanking copy + huge centered headline + capability strip + wave
// ────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-dream-lavender-soft text-dream-ink">
      <div className="relative mx-auto grid max-w-[1400px] gap-10 px-6 pb-8 pt-2 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:px-10 lg:pb-12 lg:pt-3">
        <div className="flex flex-col items-start">
          <h1 className="font-display text-[48px] font-semibold leading-[1.05] tracking-tight text-black sm:text-[64px] lg:text-[80px]">
            Why we started
            <br />
            Dreamhouse.
          </h1>

          <p className="mt-7 max-w-[560px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            We started Dreamhouse to put quality, customers, and employees
            first. Everyone here cares about what they do, so your order
            gets the same care.
          </p>

          <div
            className="sun-burst relative mt-10 inline-block"
            style={{ "--ray-color": "#ecbb25" } as CSSProperties}
          >
            {HERO_CTA_RAYS.map((ray, i) => (
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
              href="/contact"
              className="relative inline-flex items-center justify-center rounded-full bg-dream-sun px-10 py-5 font-display text-lg font-bold text-dream-ink transition-transform hover:-translate-y-0.5"
            >
              Talk to us
            </Link>
          </div>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <Image
            src="/about-hero.png"
            alt=""
            width={1063}
            height={1063}
            priority
            unoptimized
            aria-hidden="true"
            sizes="(min-width: 1024px) 600px, (min-width: 640px) 520px, 420px"
            className="h-auto w-full max-w-[420px] sm:max-w-[520px] lg:max-w-[600px]"
          />
        </div>
      </div>

      <RoughEdgeFilter />
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 2. What We Do — two rotated photo cards + heading & paragraph
// ────────────────────────────────────────────────────────────────────────────

function WhatWeDo() {
  return (
    <section className="relative bg-dream-cream pb-36 pt-32 lg:pb-48 lg:pt-40">
      <svg
        aria-hidden="true"
        preserveAspectRatio="xMidYMid"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 block h-[28px] w-full"
      >
        <defs>
          <pattern
            id="about-hero-scallop"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="0" rx="60" ry="28" fill="#e0dffe" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#about-hero-scallop)" />
      </svg>
      {/* Decorative blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-12 top-40 h-[80px] w-[80px] rotate-12 rounded-[40%_60%_55%_45%/55%_45%_60%_40%] bg-dream-sun-soft"
      />

      <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:px-10">
        {/* Two-photo column — asymmetric heights + subtle scroll parallax */}
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 items-start gap-4 sm:gap-5">
          <ParallaxScroll speed={0.02}>
            <div className="aspect-[3/4] overflow-hidden rounded-[16px] ring-1 ring-dream-ink/10">
              <Image
                src="/products/shirts.jpg"
                alt=""
                width={400}
                height={520}
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </div>
          </ParallaxScroll>
          <ParallaxScroll speed={0.05} className="mt-10 sm:mt-14">
            <div className="aspect-[3/5] overflow-hidden rounded-[16px] ring-1 ring-dream-ink/10">
              <Image
                src="/products/hoodies.jpg"
                alt=""
                width={400}
                height={620}
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </div>
          </ParallaxScroll>
        </div>

        <div>
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-dream-purple">
            Our Mission
          </span>
          <h2 className="mt-5 font-display text-[44px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[56px]">
            What we{" "}
            <span className="relative inline-block">
              do
              <ScribbleUnderline className="-bottom-1" />
            </span>
            .
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            We print high quality custom apparel on a great website that
            lets you order exactly what you need, with the minimum amount
            of hassle. Shirts, hoodies, hats, and bags. Pick your blank,
            upload your art, and you&apos;ll have a quote in your inbox
            the same day.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            Every order gets art prep, a mockup you sign off on, and a
            quality check before it ships. No outsourcing, no middlemen.
          </p>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Bold Statement — collage with overlapping polaroids and tilted heading
// ────────────────────────────────────────────────────────────────────────────

function BoldStatement() {
  return (
    <section className="relative overflow-hidden bg-dream-lavender-soft py-12 lg:py-16">
      <Image
        src="/madeinvan/sticker1.png"
        alt=""
        width={400}
        height={400}
        aria-hidden="true"
        className="pointer-events-none absolute left-12 top-24 z-0 h-auto w-[180px] sm:left-20 sm:top-32 sm:w-[240px] lg:left-32 lg:top-40 lg:w-[280px]"
      />
      <Image
        src="/madeinvan/sticker1.png"
        alt=""
        width={400}
        height={400}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-32 right-32 z-0 h-auto w-[180px] rotate-[24deg] sm:bottom-44 sm:right-56 sm:w-[240px] lg:bottom-60 lg:right-80 lg:w-[280px]"
      />

      <div className="relative w-full px-6 lg:px-10">
        <div className="grid gap-10 pb-[78px] pt-12 lg:grid-cols-[1fr_1.4fr] lg:pb-[110px] lg:pt-16">
          <div aria-hidden="true" />
          <p className="max-w-[560px] text-[17px] leading-relaxed text-dream-ink-soft sm:text-[19px] lg:justify-self-end">
            Every roll of ink, every screen, every stitch, done by hand on
            Main Street. Local craft, real materials, no shortcuts, and a
            team that actually shows up.
          </p>
        </div>

        <div className="mx-auto grid max-w-[1280px] items-center gap-10 lg:grid-cols-[1fr_1.4fr_1fr]">
          <div aria-hidden="true" className="hidden lg:block" />

          <div className="relative h-[680px] w-full sm:h-[800px] lg:h-[920px]">
            <h2 className="pointer-events-none absolute inset-0 z-20 grid place-items-center text-center font-daruma text-[88px] leading-[0.85] tracking-tight text-dream-purple sm:text-[120px] lg:text-[180px]">
              <span>
                MADE
                <br />
                IN
                <br />
                VAN
              </span>
            </h2>

            <PolaroidPhoto
              src="/madeinvan/made-in-van1.jpg"
              tilt={-12}
              className="absolute -left-36 top-20 z-10 w-[76%] sm:-left-44 sm:w-[74%] lg:-left-60 lg:w-[72%]"
              bg="bg-white"
              padding="p-1"
              delay={0}
            />
            <PolaroidPhoto
              src="/madeinvan/made-in-van2.jpg"
              tilt={8}
              className="absolute -right-16 top-0 z-10 w-[66%] sm:-right-24 sm:w-[64%] lg:-right-36 lg:w-[62%]"
              bg="bg-white"
              padding="p-1"
              delay={120}
            />
            <PolaroidPhoto
              src="/madeinvan/made-in-van3.jpg"
              tilt={-5}
              className="absolute -bottom-24 left-[60%] z-10 w-[72%] -translate-x-1/2 sm:w-[70%] lg:w-[68%]"
              bg="bg-white"
              padding="p-1"
              delay={240}
            />
          </div>

          <div aria-hidden="true" className="hidden lg:block" />
        </div>

        <div className="grid gap-10 pb-8 pt-40 lg:grid-cols-[1.4fr_1fr] lg:pb-12 lg:pt-52">
          <p className="max-w-[560px] text-[17px] leading-relaxed text-dream-ink-soft sm:text-[19px] lg:ml-24">
            Looking for a print shop that&apos;ll actually pick up the phone?
            That&apos;s us. We answer questions, send proofs, and stand
            behind every order.
          </p>
          <div aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Services — three cards with icon, name, blurb, link + CTA row
// ────────────────────────────────────────────────────────────────────────────

function Services() {
  return (
    <section className="relative overflow-hidden bg-dream-cream pb-32 pt-28 lg:pb-44 lg:pt-36">
      <Image
        src="/arrow1.svg"
        alt=""
        width={702}
        height={1359}
        aria-hidden="true"
        className="pointer-events-none absolute right-12 top-16 z-30 hidden h-auto w-[176px] md:block lg:right-32 lg:w-[236px]"
      />

      <div className="relative mx-auto max-w-[1500px] px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-dream-purple">
            How we print
          </span>
          <h2 className="mt-4 font-display text-[40px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[56px]">
            Three ways to put{" "}
            <span className="relative inline-block">
              ink
              <ScribbleUnderline className="-bottom-1" />
            </span>{" "}
            on fabric.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            Every method we keep in-house is the right tool for a different
            job. Here&apos;s when each one shines.
          </p>
        </div>

        <div className="mt-16 overflow-hidden rounded-[24px] ring-1 ring-dream-ink/10 lg:mt-20">
          <div className="grid grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.name} className="aspect-[3/4] overflow-hidden">
                <Image
                  src={s.image}
                  alt=""
                  width={520}
                  height={680}
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-12 md:grid-cols-3 md:gap-8 lg:mt-5 lg:gap-12">
          {SERVICES.map((s, idx) => {
            const number = String(idx + 1).padStart(2, "0");
            return (
              <div key={s.name} className="flex flex-col items-start">
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="font-daruma text-[32px] leading-none text-dream-purple sm:text-[40px]"
                  >
                    {number}
                  </span>
                  <h3 className="font-daruma text-[28px] leading-tight tracking-tight text-dream-ink sm:text-[34px]">
                    {s.name}
                  </h3>
                </div>
                <p className="mt-3 text-[13px] italic leading-relaxed text-dream-ink/55 sm:text-[14px]">
                  {s.bestFor}
                </p>
                <p className="mt-4 text-[13px] leading-snug text-dream-ink/65 sm:text-[14px]">
                  {s.body}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-24 flex flex-wrap items-center justify-center gap-4 lg:mt-32">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-full border-2 border-dream-ink bg-white px-7 py-3.5 font-display text-[14px] font-bold text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)]"
          >
            Contact us
          </Link>
          <Link
            href="/services"
            className="inline-flex items-center justify-center rounded-full bg-dream-purple px-7 py-3.5 font-display text-[14px] font-bold text-white shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)]"
          >
            View services
          </Link>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Bits
// ────────────────────────────────────────────────────────────────────────────

function RoughEdgeFilter() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
      <defs>
        <filter id="rough-edges" x="-5%" y="-30%" width="110%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="2"
            seed="3"
          />
          <feDisplacementMap in="SourceGraphic" scale="3" />
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

function Squiggle({ direction }: { direction: "left" | "right" }) {
  const flipped: CSSProperties = direction === "right" ? { transform: "scaleX(-1)" } : {};
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 80 14"
      className="hidden h-3 w-[80px] text-dream-ink/40 sm:block"
      style={flipped}
    >
      <path
        d="M2 7 Q 12 1 22 7 T 42 7 T 62 7 T 78 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`pointer-events-none absolute ${className}`}
      fill="currentColor"
    >
      <path d="M12 2 L13.6 9.5 L21 11 L13.6 12.5 L12 20 L10.4 12.5 L3 11 L10.4 9.5 Z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="M5.6 5.6 8.4 8.4" />
      <path d="M15.6 15.6 18.4 18.4" />
      <path d="M5.6 18.4 8.4 15.6" />
      <path d="M15.6 8.4 18.4 5.6" />
    </svg>
  );
}
