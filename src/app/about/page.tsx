import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import ParallaxImage from "@/components/ParallaxImage";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

const CAPABILITIES = [
  "SCREEN PRINT",
  "EMBROIDERY",
  "DTG",
  "TEES",
  "HOODIES",
  "HATS",
  "TOTES",
  "IN-HOUSE",
];

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

type Mascot = {
  key: string;
  title: string;
  bullets: string[];
  body: string;
  fill: string;
  accent: string;
};

const MASCOTS: Mascot[] = [
  {
    key: "InHs",
    title: "InHs",
    bullets: ["In-house", "Quality", "Crafted"],
    body: "Screens pulled, stitches sewn, packed, and shipped under one roof.",
    fill: "#afa6ff",
    accent: "#7664ff",
  },
  {
    key: "LoC",
    title: "LoC",
    bullets: ["Local", "Vancouver", "Crew"],
    body: "A small team that knows the city, the brands, and the corner shops.",
    fill: "#7664ff",
    accent: "#1b1458",
  },
  {
    key: "BeS",
    title: "BeS",
    bullets: ["Built", "to", "Last"],
    body: "Every order gets a hand quality-check before it leaves the building.",
    fill: "#ecbb25",
    accent: "#1b1458",
  },
  {
    key: "FaP",
    title: "FaP",
    bullets: ["Fair", "Pricing", "No surprises"],
    body: "One number up front. No hidden setup fees, no surprise upcharges.",
    fill: "#ffa97a",
    accent: "#1b1458",
  },
  {
    key: "SmB",
    title: "SmB",
    bullets: ["Small", "Batches", "Welcome"],
    body: "Minimums start at 25 pieces — friendly to teams, clubs, and brands.",
    fill: "#e0dffe",
    accent: "#7664ff",
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
      <Pillars />

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

      <div className="relative mx-auto max-w-[1400px] px-6 pb-24 pt-16 lg:px-10 lg:pb-28 lg:pt-20">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
          <p className="max-w-[260px] text-[13px] leading-relaxed text-white/85 sm:text-[14px] lg:justify-self-end lg:text-right">
            A small Vancouver crew running screens, ink, and stitches for
            teams, clubs, and brands that care how their stuff looks.
          </p>

          <h1 className="text-center font-display text-[68px] font-bold leading-[0.92] tracking-tight sm:text-[96px] lg:text-[140px]">
            WHY IT
            <br />
            <span className="relative inline-block">
              MATTERS
              <ScribbleUnderline className="-bottom-2 lg:-bottom-3" />
            </span>
          </h1>

          <p className="max-w-[260px] text-[13px] leading-relaxed text-white/85 sm:text-[14px]">
            We started Dreamhouse because too many shops treat custom prints
            like a vending machine. We&apos;d rather treat each job like a
            collaboration.
          </p>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-white/80 sm:gap-x-12 lg:mt-20">
          {CAPABILITIES.map((cap, i) => (
            <span
              key={cap}
              className="flex items-center gap-3 font-display text-[13px] font-bold uppercase tracking-[0.18em] sm:text-sm"
            >
              {cap}
              {i < CAPABILITIES.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="hidden h-1.5 w-1.5 rounded-full bg-dream-sun sm:inline-block"
                />
              ) : null}
            </span>
          ))}
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
        className="pointer-events-none absolute left-[-60px] top-16 h-[180px] w-[180px] rounded-full bg-dream-lavender-soft blur-[2px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-12 top-40 h-[80px] w-[80px] rotate-12 rounded-[40%_60%_55%_45%/55%_45%_60%_40%] bg-dream-sun-soft"
      />

      <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:px-10">
        {/* Photo stack */}
        <div className="relative mx-auto h-[420px] w-full max-w-[560px] sm:h-[480px] lg:h-[520px]">
          <PolaroidPhoto
            src="/methods-screen.webp"
            label="Screen prep"
            tilt={-6}
            className="absolute left-0 top-2 w-[58%] sm:w-[55%]"
          />
          <PolaroidPhoto
            src="/methods-embroidery.webp"
            label="Stitch test"
            tilt={5}
            className="absolute bottom-0 right-0 w-[60%] sm:w-[57%]"
          />
          {/* Tiny scribble cluster */}
          <svg
            aria-hidden="true"
            viewBox="0 0 80 80"
            className="absolute right-[40%] top-0 h-[50px] w-[50px] text-dream-purple"
          >
            <path
              d="M10 40 Q25 10 40 40 T70 40"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M20 60 Q35 30 50 60"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
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
            actually cares whether your hoodies hold up after twenty washes —
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
      {/* Sparkle accents */}
      <Sparkle className="left-[12%] top-12 h-6 w-6 text-dream-sun" />
      <Sparkle className="right-[10%] top-24 h-8 w-8 text-dream-purple" />
      <Sparkle className="bottom-20 left-[18%] h-5 w-5 text-dream-peach" />

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
                <span className="text-dream-purple">.</span>
              </span>
            </h2>

            <PolaroidPhoto
              src="/shopbycategories/shirtcategory.webp"
              label="Tee run"
              tilt={-12}
              className="absolute -left-2 top-2 z-10 w-[36%] sm:w-[34%] lg:w-[32%]"
              bg="bg-white"
            />
            <PolaroidPhoto
              src="/shopbycategories/hoodiecategory.webp"
              label="Hoodie batch"
              tilt={8}
              className="absolute right-0 top-10 z-10 w-[34%] sm:w-[32%] lg:w-[30%]"
              bg="bg-white"
            />
            <PolaroidPhoto
              src="/shopbycategories/hatcategory.webp"
              label="Hats up"
              tilt={-5}
              className="absolute bottom-0 left-1/2 z-10 w-[30%] -translate-x-1/2 sm:w-[28%] lg:w-[26%]"
              bg="bg-white"
            />
          </div>

          <div className="flex flex-col items-start gap-5 lg:items-start">
            <p className="max-w-[220px] text-[14px] leading-relaxed text-dream-ink-soft">
              Every roll of ink, every screen, every stitch — done by hand on
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
              className="group rounded-[24px] border-2 border-dream-ink/15 bg-white px-7 pb-7 pt-8 transition hover:-translate-y-1 hover:border-dream-ink/40 hover:shadow-[0_18px_36px_-20px_rgba(27,20,88,0.4)]"
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
              <Link
                href={s.href}
                className="mt-5 inline-flex items-center gap-1 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-dream-purple underline-offset-4 transition group-hover:underline"
              >
                Read more →
              </Link>
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
// 5. Pillars — mascot row with stats below (the "NoPD/NoTEx/NoZ" section)
// ────────────────────────────────────────────────────────────────────────────

function Pillars() {
  return (
    <section className="relative bg-dream-cream pt-20 lg:pt-28">
      <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
        {/* Mascot row */}
        <div className="relative flex flex-wrap items-end justify-center gap-x-6 gap-y-4 sm:gap-x-10 lg:gap-x-14">
          {MASCOTS.map((m, i) => (
            <Mascot key={m.key} mascot={m} index={i} />
          ))}
        </div>
      </div>

      {/* Green floor */}
      <div className="relative bg-[#7fb685] pb-20 pt-14 lg:pb-28 lg:pt-16">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            {MASCOTS.map((m) => (
              <div key={m.key} className="text-white">
                <h3
                  className="font-display text-[32px] font-bold leading-tight tracking-tight"
                  style={{ color: m.fill }}
                >
                  {m.title}
                </h3>
                <ul className="mt-3 space-y-1 font-display text-[15px] font-bold leading-tight text-white">
                  {m.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mt-3 text-[13px] leading-relaxed text-white/85">
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Mascot — simple SVG blob figure with two eyes, in brand colors
// ────────────────────────────────────────────────────────────────────────────

function Mascot({ mascot, index }: { mascot: Mascot; index: number }) {
  // Vary heights/proportions per index so the row feels less uniform
  const variants = [
    { h: 180, w: 110, eyeY: 78 },
    { h: 220, w: 130, eyeY: 88 },
    { h: 200, w: 105, eyeY: 82 },
    { h: 170, w: 100, eyeY: 70 },
    { h: 210, w: 125, eyeY: 88 },
  ];
  const v = variants[index % variants.length];
  return (
    <svg
      viewBox={`0 0 ${v.w} ${v.h}`}
      width={v.w}
      height={v.h}
      aria-hidden="true"
      className="block h-auto w-[64px] sm:w-[88px] lg:w-[110px]"
    >
      {/* Body — stacked rounded blob */}
      <ellipse
        cx={v.w / 2}
        cy={v.h - 38}
        rx={v.w / 2 - 6}
        ry={56}
        fill={mascot.fill}
      />
      <ellipse
        cx={v.w / 2}
        cy={v.h - 95}
        rx={v.w / 2 - 14}
        ry={44}
        fill={mascot.fill}
      />
      {/* Head */}
      <circle cx={v.w / 2} cy={v.h - 150} r={Math.min(v.w / 2 - 4, 38)} fill={mascot.fill} />
      {/* Eyes */}
      <circle cx={v.w / 2 - 10} cy={v.h - 152} r={3} fill={mascot.accent} />
      <circle cx={v.w / 2 + 10} cy={v.h - 152} r={3} fill={mascot.accent} />
      {/* Tiny scribble cheek tint */}
      <ellipse
        cx={v.w / 2}
        cy={v.h - 138}
        rx={6}
        ry={2}
        fill={mascot.accent}
        opacity={0.18}
      />
    </svg>
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
}: {
  src: string;
  label: string;
  tilt: number;
  className?: string;
  bg?: string;
}) {
  return (
    <figure
      className={`${bg} ${className} rounded-[14px] p-3 shadow-[0_18px_30px_-18px_rgba(27,20,88,0.55)] ring-1 ring-dream-ink/5`}
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
      <figcaption className="mt-2 px-1 pb-1 text-center font-display text-[12px] font-bold uppercase tracking-[0.16em] text-dream-ink/70">
        {label}
      </figcaption>
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
