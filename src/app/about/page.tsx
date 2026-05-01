import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import ParallaxImage from "@/components/ParallaxImage";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

// Sun-burst rays around the hero CTA — matches the Quick Quote pill in SiteNav.
const SUN_RAYS = Array.from({ length: 12 }, (_, i) => {
  const angle = i * 30;
  const rad = (angle * Math.PI) / 180;
  const rx = 100;
  const ry = 54;
  const lenJitter = [18, 14, 17, 15, 19, 13, 17, 15, 18, 14, 16, 15][i];
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
    body: "Bold, long-lasting prints. Best for bulk runs of tees, hoodies, and totes.",
    href: "/services#methods",
  },
  {
    name: "Embroidery",
    body: "Thread stitched into the fabric for a premium finish on polos and hats.",
    href: "/services#methods",
  },
  {
    name: "DTG printing",
    body: "Direct-to-garment for full-colour prints, no minimums, no fuss.",
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
    <section className="relative isolate overflow-hidden text-white">
      <ParallaxImage src="/cta-shirt.webp" speed={0.18} className="-z-10" />
      <div
        className="absolute inset-0 -z-10 bg-dream-ink/65"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1400px] px-6 pb-10 pt-16 lg:px-10 lg:pb-12 lg:pt-20">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-center font-display text-[68px] font-bold leading-[0.92] tracking-tight sm:text-[96px] lg:text-[140px]">
            ABOUT US
          </h1>

          <p className="max-w-[520px] text-center text-[14px] leading-relaxed text-white/85 sm:text-[16px]">
            We started Dreamhouse because too many shops treat custom prints
            like a vending machine. We&apos;d rather treat each job like a
            collaboration.
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <div className="sun-burst relative inline-block">
            {SUN_RAYS.map((ray, i) => (
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
                    "--ray-color": "var(--color-dream-sun)",
                    width: `${ray.len}px`,
                  } as CSSProperties
                }
              />
            ))}
            <Link
              href="/contact"
              className="relative inline-flex items-center justify-center rounded-full bg-dream-sun px-10 py-4 font-display text-[18px] font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </div>

      {/* Wavy bottom edge — same shape language used elsewhere */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="pointer-events-none block h-[60px] w-full sm:h-[90px] lg:h-[120px]"
      >
        <path d="M 0 90 Q 360 0 720 60 T 1440 90 V 120 H 0 Z" fill="#f4f2ff" />
      </svg>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 2. What We Do — two rotated photo cards + heading & paragraph
// ────────────────────────────────────────────────────────────────────────────

function WhatWeDo() {
  return (
    <section className="relative bg-dream-cream pb-24 pt-24 lg:pb-32 lg:pt-32">
      {/* Decorative blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-12 top-40 h-[80px] w-[80px] rotate-12 rounded-[40%_60%_55%_45%/55%_45%_60%_40%] bg-dream-sun-soft"
      />

      <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:px-10">
        {/* Photo stack */}
        <div className="relative mx-auto h-[420px] w-full max-w-[560px] sm:h-[480px] lg:h-[520px]">
          <div
            className="absolute left-0 top-2 w-[58%] overflow-hidden rounded-[12px] sm:w-[55%]"
            style={{ rotate: "-6deg" }}
          >
            <Image
              src="/methods-screen.webp"
              alt=""
              width={520}
              height={520}
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          </div>
          <div
            className="absolute bottom-0 right-0 w-[60%] overflow-hidden rounded-[12px] sm:w-[57%]"
            style={{ rotate: "5deg" }}
          >
            <Image
              src="/methods-embroidery.webp"
              alt=""
              width={520}
              height={520}
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          </div>
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
            We help local brands, teams, and small businesses turn ideas into
            things you can actually wear. Every order gets art prep, a mockup
            you sign off on, and a quality check before it ships. No
            outsourcing, no middlemen.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            That means quicker answers, fewer surprises, and a team that
            actually cares whether your hoodies hold up after twenty washes,
            because we&apos;re the ones printing them.
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
    <section className="relative overflow-hidden bg-dream-lavender-soft py-28 lg:py-36">
      <div className="relative mx-auto max-w-[1280px] px-6 lg:px-10">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.4fr_1fr]">
          <p className="max-w-[220px] text-[14px] leading-relaxed text-dream-ink-soft lg:justify-self-end lg:text-right">
            Looking for a print shop that&apos;ll actually pick up the phone?
            That&apos;s us.
          </p>

          <div className="relative h-[360px] w-full sm:h-[400px] lg:h-[460px]">
            <h2 className="absolute inset-0 grid place-items-center text-center font-display text-[88px] font-bold leading-[0.85] tracking-tight text-dream-ink sm:text-[120px] lg:text-[180px]">
              <span>
                MADE
                <br />
                IN
                <br />
                VAN
              </span>
            </h2>

            <PolaroidPhoto
              src="/shopbycategories/shirtcategory.webp"
              tilt={-12}
              className="absolute -left-2 top-28 z-10 w-[36%] sm:w-[34%] lg:w-[32%]"
              bg="bg-white"
              padding="p-1.5"
            />
            <PolaroidPhoto
              src="/shopbycategories/hoodiecategory.webp"
              tilt={8}
              className="absolute right-0 top-10 z-10 w-[34%] sm:w-[32%] lg:w-[30%]"
              bg="bg-white"
              padding="p-1.5"
            />
            <PolaroidPhoto
              src="/shopbycategories/hatcategory.webp"
              tilt={-5}
              className="absolute -bottom-32 left-1/2 z-10 w-[40%] -translate-x-1/2 sm:w-[38%] lg:w-[36%]"
              bg="bg-white"
              padding="p-1.5"
            />
          </div>

          <div className="flex flex-col items-start gap-5 lg:items-start">
            <p className="max-w-[220px] text-[14px] leading-relaxed text-dream-ink-soft">
              Every roll of ink, every screen, every stitch, done by hand on
              Main Street.
            </p>
            <Link
              href="/quote"
              className="rough-pill rough-pill-filled rough-pill-lean inline-flex items-center justify-center px-8 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              See our work
            </Link>
          </div>
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
    <section className="bg-dream-cream pb-24 pt-24 lg:pb-32 lg:pt-32">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <div className="flex items-center justify-center gap-4">
          <Squiggle direction="left" />
          <h2 className="text-center font-display text-[40px] font-bold leading-tight tracking-tight text-dream-ink sm:text-[52px]">
            How we work
          </h2>
          <Squiggle direction="right" />
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {SERVICES.map((s) => (
            <article
              key={s.name}
              className="rounded-[24px] border-2 border-dream-ink/15 bg-white px-7 pb-7 pt-8"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-dream-lavender-soft text-dream-purple">
                <SparkIcon />
              </span>
              <h3 className="mt-5 font-display text-[20px] font-bold leading-tight text-dream-ink">
                {s.name}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-dream-ink-soft">
                {s.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
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

function PolaroidPhoto({
  src,
  label,
  tilt,
  className = "",
  bg = "bg-white",
  padding = "p-3",
}: {
  src: string;
  label?: string;
  tilt: number;
  className?: string;
  bg?: string;
  padding?: string;
}) {
  return (
    <figure
      className={`${bg} ${className} ${padding} rounded-[14px] shadow-[0_18px_30px_-18px_rgba(27,20,88,0.55)] ring-1 ring-dream-ink/5`}
      style={{ rotate: `${tilt}deg` }}
    >
      <div className="aspect-square w-full overflow-hidden rounded-[8px] bg-dream-lavender-soft">
        <Image
          src={src}
          alt=""
          width={520}
          height={520}
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
      </div>
      {label ? (
        <figcaption className="mt-2 px-1 pb-1 text-center font-display text-[12px] font-bold uppercase tracking-[0.16em] text-dream-ink/70">
          {label}
        </figcaption>
      ) : null}
    </figure>
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
