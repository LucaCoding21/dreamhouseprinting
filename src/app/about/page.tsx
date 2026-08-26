import Image from "next/image";
import Link from "next/link";
import ParallaxScroll from "@/components/ParallaxScroll";
import Reveal from "@/components/Reveal";
import ShopReel from "@/components/ShopReel";
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
      <BehindTheScenes />
      <ReadyCTA />

      <SiteFooter />
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Hero, flanking copy + huge centered headline + capability strip + wave
// ────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative isolate flex min-h-[180px] flex-col justify-center overflow-hidden bg-dream-lavender-soft text-dream-ink lg:min-h-[260px]">
      <div className="relative mx-auto grid w-full max-w-[1400px] gap-10 px-6 pb-20 pt-12 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:px-10 lg:pb-32 lg:pt-12">
        <div className="flex flex-col items-start">
          <h1 className="font-display text-[44px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[52px] lg:text-[76px]">
            Why we started
            <br />
            Dreamhouse<span className="hidden lg:inline">.</span>
          </h1>

          <p className="mt-7 max-w-[560px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            We started Dreamhouse as a Vancouver print shop that puts quality,
            customers, and employees first. Everyone here cares about what
            they do, so your order gets the same care.
          </p>

        </div>

        <div className="relative flex justify-center pr-2 lg:justify-end lg:pr-6">
          {/* w-full + max-w at base so the frame can never outgrow narrow
              phones; from sm up it goes back to shrink-to-fit fixed widths. */}
          <div className="relative w-full max-w-[356px] sm:w-auto sm:max-w-none">
            <Image
              src="/sticker3.png"
              alt=""
              aria-hidden="true"
              width={400}
              height={400}
              className="pointer-events-none absolute -left-10 -top-6 z-0 h-auto w-[110px] -rotate-12 sm:-left-14 sm:-top-8 sm:w-[140px] lg:-left-20 lg:-top-10 lg:w-[170px]"
            />

            <div className="relative z-10 -rotate-[2deg] rounded-xl bg-white p-2 shadow-[8px_8px_0_0_rgba(27,20,88,1)] sm:p-2.5">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg sm:w-[450px] lg:w-[560px]">
                <Image
                  src="/screen-printing-squeegee-vancouver-shop.png"
                  alt="Dreamhouse screen printer pulling a fresh print at the Vancouver shop"
                  title="Inside our Vancouver screen print shop"
                  fill
                  priority
                  sizes="(min-width: 1024px) 560px, (min-width: 640px) 450px, 340px"
                  className="object-cover object-top"
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
// 2. What We Do, two rotated photo cards + heading & paragraph
// ────────────────────────────────────────────────────────────────────────────

function WhatWeDo() {
  return (
    <section className="relative bg-dream-cream pb-16 pt-16 sm:pb-36 sm:pt-32 lg:pb-48 lg:pt-40">
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
            <ellipse cx="60" cy="-1" rx="60" ry="29" fill="#e0dffe" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#about-hero-scallop)" />
      </svg>
      {/* Decorative blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-12 top-40 h-[80px] w-[80px] rotate-12 rounded-[40%_60%_55%_45%/55%_45%_60%_40%] bg-dream-sun-soft"
      />

      {/* justify-center is lg-only on purpose: it centres the grid TRACK, and a
          single implicit auto track sizes to its content (the 720px photo
          block), so on a phone the row grew past the viewport and spilled out
          both sides. Only the two-column desktop layout wants it. */}
      <div className="relative mx-auto mt-8 grid max-w-[1560px] items-center gap-7 px-6 sm:mt-12 sm:gap-12 md:px-8 lg:mt-16 lg:grid-cols-[auto_auto] lg:justify-center lg:gap-24 lg:px-10">
        {/* Mobile/tablet: heading sits above the photos. On lg the heading
            moves into the text column on the right (rendered below). */}
        <div className="mx-auto max-w-[560px] text-center lg:hidden">
          <span className="block font-display text-[14px] font-bold uppercase tracking-[0.18em] text-dream-purple">
            Our Mission
          </span>
          <h2 className="mt-5 font-display text-[30px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[56px]">
            Our{" "}
            <span className="whitespace-nowrap">
              <span className="relative inline-block">
                story
                <ScribbleUnderline className="-bottom-1" />
              </span>
              .
            </span>
          </h2>
        </div>

        {/* Two-photo column, asymmetric heights + subtle scroll parallax */}
        {/* Phones get an even pair at a softer aspect: the 0.8fr/1.2fr split with
            one photo dropped 40px below the other is a desktop composition, and
            at phone width it read as two mismatched slivers. */}
        <div className="mx-auto grid w-full max-w-[720px] grid-cols-2 items-start gap-3 sm:grid-cols-[0.8fr_1.2fr] sm:gap-5">
          <ParallaxScroll speed={0.02}>
            <div className="aspect-[4/5] overflow-hidden rounded-[8px] ring-1 ring-dream-ink/10 sm:aspect-[3/5]">
              <Image
                src="/screen-printed-graphic-tshirts-vancouver.png"
                alt=""
                width={400}
                height={520}
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </div>
          </ParallaxScroll>
          <ParallaxScroll speed={0.05} className="sm:mt-14">
            <div className="aspect-[4/5] overflow-hidden rounded-[8px] ring-1 ring-dream-ink/10 sm:aspect-[3/5]">
              <Image
                src="/embroidered-hoodies-stack-vancouver.png"
                alt=""
                width={400}
                height={620}
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </div>
          </ParallaxScroll>
        </div>

        <div className="mx-auto max-w-[560px] text-left lg:mx-0">
          <div className="hidden lg:block">
            <span className="font-display text-[14px] font-bold uppercase tracking-[0.18em] text-dream-purple">
              Our Mission
            </span>
            <h2 className="mt-5 font-display text-[30px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[56px]">
              Our{" "}
              <span className="whitespace-nowrap">
                <span className="relative inline-block">
                  story
                  <ScribbleUnderline className="-bottom-1" />
                </span>
                .
              </span>
            </h2>
          </div>
          {/* mt-8 separates this from the heading, which only renders at lg.
              Below that it was stacking on the grid's row gap under the photos. */}
          <p className="text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px] lg:mt-8">
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
// 3. Behind the Scenes, landscape video + photo placeholders of the print process
// ────────────────────────────────────────────────────────────────────────────
//
// PLACEHOLDERS: swap the <MediaPlaceholder /> boxes for real media.
//   • Video  → replace with a <video> tag (see the commented example inside
//     MediaPlaceholder) pointing at an .mp4/.webm you drop in /public.
//   • Photo  → replace with <Image src="/your-photo.jpg" fill ... />.
// The frames are all landscape (16:9 for video, 4:3 for photos) so the layout
// holds its shape whether a box is a placeholder or the real thing.

function BehindTheScenes() {
  return (
    <section className="relative overflow-hidden bg-dream-lavender-soft pb-12 pt-24 sm:pb-24 lg:pb-32 lg:pt-32">
      <svg
        aria-hidden="true"
        preserveAspectRatio="xMidYMid"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 block h-[28px] w-full"
      >
        <defs>
          <pattern
            id="about-bts-scallop"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="-1" rx="60" ry="29" fill="#f4f2ff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#about-bts-scallop)" />
      </svg>

      {/* Decorative sticker, fills the empty top-right corner */}
      <Image
        src="/madeinvan/sticker1.png"
        alt=""
        width={400}
        height={400}
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-12 z-0 hidden h-auto w-[130px] rotate-[12deg] sm:block lg:right-14 lg:w-[170px]"
      />

      {/* Flex + order: on phones the reels sit directly under the heading and
          scroll sideways; from sm up the original heading/copy/grid returns. */}
      <div className="relative mx-auto flex max-w-[1440px] flex-col px-6 md:px-8 lg:px-10">
        {/* TOP-LEFT, heading */}
        <div className="order-1 max-w-[560px] text-left">
          <h2 className="font-display text-[30px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[56px]">
            Behind the{" "}
            {/* nowrap: the scribbled word is an inline-block, which lets the
                period break onto its own line. Keep them together. */}
            <span className="whitespace-nowrap">
              <span className="relative inline-block">
                scenes
                <ScribbleUnderline className="-bottom-1" />
              </span>
              .
            </span>
          </h2>
        </div>

        {/* Video reels. Phones: edge-to-edge snap scroller so the next card
            peeks and the row reads as swipeable. sm+: the three-up grid. */}
        {/* scroll-pl matches the px inset: without it snap-start aligns cards
            to the scroller's border edge, so the first video sat flush against
            the screen instead of lining up under the heading. */}
        <div className="no-scrollbar order-2 -mx-6 mt-8 flex snap-x snap-mandatory scroll-pl-6 gap-4 overflow-x-auto px-6 pb-2 sm:order-3 sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-3 sm:gap-7 sm:overflow-visible sm:px-0 sm:pb-0 md:-mx-8 md:scroll-pl-8 md:px-8 lg:mx-0 lg:mt-16 lg:ml-auto lg:w-[80%] lg:gap-8 lg:px-0">
          <ShopReel
            className="w-[72%] shrink-0 snap-start sm:w-auto sm:shrink"
            src="/behind-the-scenes/screen-printing-vancouver-shop.mp4"
            poster="/behind-the-scenes/screen-printing-vancouver-shop.jpg"
            label="Screen printing in progress at our Vancouver shop"
          />
          <ShopReel
            className="w-[72%] shrink-0 snap-start sm:w-auto sm:shrink"
            src="/behind-the-scenes/screen-printing-press-vancouver.mp4"
            poster="/behind-the-scenes/screen-printing-press-vancouver.jpg"
            label="Pulling ink across the screen at our Vancouver shop"
          />
          <ShopReel
            className="w-[72%] shrink-0 snap-start sm:w-auto sm:shrink"
            src="/behind-the-scenes/custom-screen-printing-vancouver.mp4"
            poster="/behind-the-scenes/custom-screen-printing-vancouver.jpg"
            label="Custom screen printing at our Vancouver studio"
          />
        </div>

        {/* Copy, below the reels on phones and above them from sm up */}
        <div className="order-3 mt-8 max-w-[560px] text-left sm:order-2 sm:mt-7">
          <p className="text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            Ever wondered how a blank shirt turns into the real thing? Here&apos;s
            a look inside the shop, from burning screens to the press pulling
            ink, so you can see exactly where your order gets made.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            Every order runs through these same hands and machines. No
            middleman, no guesswork, just real people making your stuff right
            here in the shop.
          </p>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Ready CTA, soft closing call-to-action
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
            <ellipse cx="60" cy="-1" rx="60" ry="29" fill="#e0dffe" />
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
          <div className="mx-auto mt-10 flex max-w-[340px] flex-col items-stretch justify-center gap-4 sm:max-w-none sm:flex-row sm:items-center sm:gap-5">
            <Link
              href="/shop"
              className="rough-pill rough-pill-filled rough-pill-lean inline-flex w-full items-center justify-center px-10 py-5 font-display text-lg font-bold text-white transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Start your order
            </Link>
            <Link
              href="/contact"
              className="rough-pill rough-pill-outline rough-pill-lean inline-flex w-full items-center justify-center px-10 py-5 font-display text-lg font-bold text-dream-purple transition-transform hover:-translate-y-0.5 sm:w-auto"
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

