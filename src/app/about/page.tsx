import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import ParallaxScroll from "@/components/ParallaxScroll";
import PolaroidPhoto from "@/components/PolaroidPhoto";
import Reveal from "@/components/Reveal";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

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
      <ReadyCTA />

      <SiteFooter />
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Hero — flanking copy + huge centered headline + capability strip + wave
// ────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative isolate flex min-h-[180px] flex-col justify-center overflow-hidden bg-dream-lavender-soft text-dream-ink md:min-h-[220px] lg:min-h-[260px]">
      <div className="relative mx-auto grid w-full max-w-[1400px] gap-10 px-6 pb-20 pt-12 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-12 md:px-8 md:pb-24 md:pt-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:px-10 lg:pb-32 lg:pt-12">
        <div className="flex flex-col items-start">
          <h1 className="font-display text-[44px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[52px] md:text-[64px] lg:text-[76px]">
            Why we started
            <br />
            Dreamhouse<span className="hidden md:inline">.</span>
          </h1>

          <p className="mt-7 max-w-[560px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            We started Dreamhouse as a Vancouver print shop that puts quality,
            customers, and employees first. Everyone here cares about what
            they do, so your order gets the same care.
          </p>

        </div>

        <div className="relative flex justify-center pr-2 lg:justify-end lg:pr-6">
          <div className="relative">
            <Image
              src="/sticker3.png"
              alt=""
              aria-hidden="true"
              width={400}
              height={400}
              className="pointer-events-none absolute -left-10 -top-6 z-0 h-auto w-[110px] -rotate-12 sm:-left-14 sm:-top-8 sm:w-[140px] lg:-left-20 lg:-top-10 lg:w-[170px]"
            />

            <div className="relative z-10 -rotate-[2deg] rounded-xl bg-white p-2 shadow-[8px_8px_0_0_rgba(27,20,88,1)] sm:p-2.5">
              <div className="relative aspect-square w-[300px] overflow-hidden rounded-lg sm:w-[400px] lg:w-[480px]">
                <Image
                  src="/dreamhouse-screen-print-shop-vancouver.webp"
                  alt="Dreamhouse screen printer pulling a fresh print at the Vancouver shop"
                  title="Inside our Vancouver screen print shop"
                  fill
                  priority
                  sizes="(min-width: 1024px) 480px, (min-width: 640px) 400px, 300px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
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

      <div className="relative mx-auto mt-12 grid max-w-[1560px] items-center justify-center gap-12 px-6 md:mt-16 md:grid-cols-[auto_auto] md:gap-14 md:px-8 lg:gap-24 lg:px-10">
        {/* Two-photo column — asymmetric heights + subtle scroll parallax */}
        <div className="mx-auto grid w-full max-w-[680px] grid-cols-2 items-start gap-4 sm:gap-5">
          <ParallaxScroll speed={0.02}>
            <div className="aspect-[3/4] overflow-hidden rounded-[16px] ring-1 ring-dream-ink/10">
              <Image
                src="/products/custom-t-shirts-vancouver.jpg"
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
                src="/products/custom-hoodies-vancouver.jpg"
                alt=""
                width={400}
                height={620}
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </div>
          </ParallaxScroll>
        </div>

        <div className="max-w-[560px]">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-dream-purple">
            Our Mission
          </span>
          <h2 className="mt-5 font-display text-[38px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[56px]">
            Our{" "}
            <span className="relative inline-block">
              story
              <ScribbleUnderline className="-bottom-1" />
            </span>
            .
          </h2>
          <p className="mt-8 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            Everyone here at Dreamhouse Printing once worked at another print
            shop, and we all walked away with the same thought: this could be
            done better.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            After years of working at other shops we realized &ldquo;This
            won&apos;t get done right unless we do it ourselves&rdquo;. So we
            pooled our money, bought out an old shop that was closing down,
            got a ridiculously big Enterprise Truck Rental (it&apos;s actually
            insane they let people drive these things) and moved into our
            current home on Alexander Street.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            Our goal is to be the type of business we would want to buy from
            customers, and to be the bosses we always wanted as employees.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            We started Dreamhouse to build something that was ours, and every
            customer that stops by our site or makes an order helps us do that.
            Thanks for being a part of it, and thanks for taking the time to
            read our story.
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
    <section className="relative overflow-hidden bg-dream-lavender-soft pb-12 pt-24 sm:pt-20 lg:pb-16 lg:pt-32">
      <svg
        aria-hidden="true"
        preserveAspectRatio="xMidYMid"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 block h-[28px] w-full"
      >
        <defs>
          <pattern
            id="about-madeinvan-scallop"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="0" rx="60" ry="28" fill="#f4f2ff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#about-madeinvan-scallop)" />
      </svg>
      <Image
        src="/madeinvan/sticker1.png"
        alt=""
        width={400}
        height={400}
        aria-hidden="true"
        className="pointer-events-none absolute left-12 top-24 z-0 hidden h-auto w-[180px] sm:block sm:left-20 sm:top-32 sm:w-[240px] lg:left-32 lg:top-40 lg:w-[280px]"
      />
      <Image
        src="/madeinvan/sticker1.png"
        alt=""
        width={400}
        height={400}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-32 right-32 z-0 hidden h-auto w-[180px] rotate-[24deg] sm:block sm:bottom-44 sm:right-56 sm:w-[240px] lg:bottom-60 lg:right-80 lg:w-[280px]"
      />

      <div className="relative w-full px-6 lg:px-10">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 lg:grid-cols-[1fr_1.4fr_1fr]">
          <div aria-hidden="true" className="hidden lg:block" />

          <div className="relative h-[520px] w-full sm:h-[720px] md:h-[800px] lg:h-[920px]">
            <h2 className="pointer-events-none absolute inset-0 z-20 grid place-items-center text-center font-daruma text-[92px] leading-[0.85] tracking-tight text-dream-purple-dark [-webkit-text-stroke:3px_#f4f2ff] [paint-order:stroke_fill] drop-shadow-[3px_4px_0_rgba(27,20,88,0.85)] sm:text-[140px] sm:[-webkit-text-stroke:4px_#f4f2ff] md:text-[172px] md:[-webkit-text-stroke:5px_#f4f2ff] lg:text-[212px] lg:[-webkit-text-stroke:6px_#f4f2ff]">
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
              className="absolute left-0 top-16 z-10 w-[58%] sm:-left-44 sm:top-20 sm:w-[74%] lg:-left-60 lg:w-[72%]"
              bg="bg-white"
              padding="p-1"
              delay={0}
            />
            <PolaroidPhoto
              src="/madeinvan/made-in-van2.jpg"
              tilt={8}
              className="absolute right-0 top-0 z-10 w-[54%] sm:-right-24 sm:w-[64%] lg:-right-36 lg:w-[62%]"
              bg="bg-white"
              padding="p-1"
              delay={120}
            />
            <PolaroidPhoto
              src="/madeinvan/made-in-van3.jpg"
              tilt={-5}
              className="absolute -bottom-12 left-1/2 z-10 w-[62%] -translate-x-1/2 sm:-bottom-24 sm:left-[60%] sm:w-[70%] lg:w-[68%]"
              bg="bg-white"
              padding="p-1"
              delay={240}
            />
          </div>

          <div aria-hidden="true" className="hidden lg:block" />
        </div>

        <div className="grid gap-10 pb-4 pt-16 sm:pb-8 sm:pt-40 lg:grid-cols-[1.4fr_1fr] lg:pb-12 lg:pt-52">
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
// 4. Ready CTA — soft closing call-to-action
// ────────────────────────────────────────────────────────────────────────────

function ReadyCTA() {
  return (
    <section className="relative bg-dream-cream py-20 lg:py-28">
      <svg
        aria-hidden="true"
        preserveAspectRatio="xMidYMid"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 block h-[28px] w-full"
      >
        <defs>
          <pattern
            id="about-cta-scallop"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="0" rx="60" ry="28" fill="#e0dffe" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#about-cta-scallop)" />
      </svg>

      <div className="relative mx-auto max-w-[760px] px-6 text-center lg:px-10">
        <Reveal variant="up">
          <h2 className="font-display text-[44px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[56px] lg:text-[64px]">
            Let&apos;s make something good.
          </h2>
        </Reveal>
        <Reveal variant="up" delay={80}>
          <p className="mt-6 text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
            Kick off a quote whenever you&apos;re ready, or send us a message
            if you&apos;d rather chat it through first. We&apos;re always
            around :)
          </p>
        </Reveal>
        <Reveal variant="up" delay={160}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
            <Link
              href="/quote"
              className="rough-pill rough-pill-filled rough-pill-lean inline-flex items-center justify-center px-10 py-5 font-display text-lg font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Start your order
            </Link>
            <Link
              href="/contact"
              className="rough-pill rough-pill-outline rough-pill-lean inline-flex items-center justify-center px-10 py-5 font-display text-lg font-bold text-dream-purple transition-transform hover:-translate-y-0.5"
            >
              Contact us
            </Link>
          </div>
        </Reveal>
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
