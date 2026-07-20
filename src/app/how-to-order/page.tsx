import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FAQAccordion from "@/components/FAQAccordion";
import HowToOrderSteps from "@/components/HowToOrderSteps";
import Reveal from "@/components/Reveal";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "How to Order | Dreamhouse Printing",
  description:
    "Ordering custom apparel from Dreamhouse Printing is easy. Design online or request a quick quote, approve your proof, pay, and we print and ship it to you in Vancouver.",
};

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

type StartOption = {
  icon: "cart" | "clipboard";
  title: string;
  description: string;
  href: string;
  cta: string;
  tone: "purple" | "white";
};

const START_OPTIONS: StartOption[] = [
  {
    icon: "cart",
    title: "Design it online",
    description:
      "Browse the shop, pick your product and colour, then drop your art onto it in the designer. You'll see a live price and a mockup before you send it over.",
    href: "/shop",
    cta: "Start designing",
    tone: "purple",
  },
  {
    icon: "clipboard",
    title: "Get a quick quote",
    description:
      "Not ready to design? Tell us the product, quantity, and print, and we'll get you an instant estimate. Upload art now or send it later, whatever's easiest.",
    href: "/#quick-quote",
    cta: "Get a quote",
    tone: "white",
  },
];

type GoodToKnow = {
  title: string;
  body: string;
};

const GOOD_TO_KNOW: GoodToKnow[] = [
  {
    title: "Bring your own art",
    body: "Vector files are best, but high-res PNGs and JPEGs work great too. No design yet? We can point you to designers we love, or you can start in Canva.",
  },
  {
    title: "Order any quantity",
    body: "There's no minimum. Pricing is quantity-based, so bigger runs cost less per piece. For small orders, DTG and DTF keep things affordable.",
  },
  {
    title: "Know your timeline",
    body: "Standard turnaround is about 10 business days. In a rush? Add rush at checkout, or reach out and we'll see what same-day options we have.",
  },
];

const FAQS = [
  {
    q: "How do I place an order?",
    a: "Two ways: design it yourself in the online designer, or send us a quick quote request. Either way, we review everything, send you a proof to approve, and once you pay we get printing.",
  },
  {
    q: "Do I pay before or after the proof?",
    a: "After. You'll always see and approve a proof first. Once it looks good, you pay by card or e-transfer, and only then does printing begin.",
  },
  {
    q: "Can I change my order after I submit it?",
    a: "Yes. Before you approve the proof, let us know if you need different sizes, quantities, colours, or products and we'll adjust it. Just reply to your order email or contact us.",
  },
  {
    q: "How will I know where my order is?",
    a: "Every order gets its own tracker in your account, from received to proof to printing to delivered. We'll email you at each step too.",
  },
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function HowToOrderPage() {
  return (
    <main className="min-h-screen bg-dream-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>

      <Link
        href="/contact#coastal-reign"
        className="hidden bg-[#c6ff3d] text-[#8f55e5] transition hover:brightness-95 sm:block"
      >
        <p className="mx-auto max-w-[1400px] whitespace-nowrap px-4 py-2 text-center text-[12px] font-bold sm:whitespace-normal sm:px-6 sm:text-[15px]">
          We price match Coastal Reign and Get Bold! Submit a request and we&apos;ll{" "}
          <span className="font-display font-extrabold uppercase tracking-wide">
            beat it by 5%
          </span>
        </p>
      </Link>

      <Hero />
      <StartOptions />
      <HowToOrderSteps />
      <GoodToKnowSection />

      {/* The FAQ sits above the sticky CTA (higher z, opaque background) so that
          as you scroll it lifts up and reveals the CTA pinned behind it. */}
      <div className="relative">
        <div className="relative z-10">
          <FAQ />
        </div>
        <CTA />
      </div>

      {/* Footer sits flush against the sticky CTA reveal, drop the shared
          footer's top margin so the cream page bg doesn't show as a gap. */}
      <div className="[&>footer]:!mt-0">
        <SiteFooter />
      </div>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Hero
// ────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-dream-lavender-soft text-dream-ink">
      <div className="relative mx-auto grid w-full max-w-[1450px] items-center gap-12 px-6 pb-24 pt-12 md:px-8 md:pb-28 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(420px,600px)] lg:gap-16 lg:px-10 lg:pb-32 lg:pt-20">
        <div>
          <span className="font-display text-xs font-bold uppercase tracking-[0.06em] text-dream-purple">
            How to order
          </span>
          <h1 className="mt-4 max-w-[820px] font-display text-[48px] font-bold leading-[1.0] tracking-tight text-dream-ink sm:text-[58px] md:text-[74px] lg:text-[86px]">
            Ordering custom gear is easy.
          </h1>
          <p className="mt-6 max-w-[560px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            From first idea to doorstep, here&apos;s exactly how it works. Design
            online or ask for a quick quote, approve a proof, pay, and we print
            it in house right here in Vancouver.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/shop"
              className="rough-pill rough-pill-filled inline-flex items-center justify-center px-8 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Start designing
            </Link>
            <Link
              href="/#quick-quote"
              className="inline-flex items-center justify-center rounded-full border-2 border-dream-ink px-8 py-4 font-display text-base font-bold text-dream-ink transition-transform hover:-translate-y-0.5 hover:bg-dream-ink hover:text-white"
            >
              Get a quote
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[560px]">
          <div className="overflow-hidden rounded-[28px] bg-white p-2.5 shadow-[10px_10px_0_0_rgba(27,20,88,0.95)] ring-1 ring-dream-ink/10 rotate-[1.5deg]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/custom-crewnecks-vancouver-studio.jpeg"
              alt="Stacks of custom-printed crewnecks folded on the worktable in the Dreamhouse Printing studio in Vancouver"
              width={1448}
              height={1086}
              loading="eager"
              className="h-auto w-full rounded-[20px]"
            />
          </div>
          <span className="absolute -bottom-4 -left-4 rotate-[-4deg] rounded-full bg-dream-sun px-5 py-2 font-display text-[13px] font-extrabold text-dream-ink shadow-[4px_4px_0_0_rgba(27,20,88,0.9)] sm:text-sm">
            Printed in house
          </span>
        </div>
      </div>

      {/* Squiggle divider, cream body waves up into the lavender hero. Same
          technique as the shop hero wave, but a repeating multi-hump squiggle
          rather than one big swell. */}
      <svg
        aria-hidden="true"
        preserveAspectRatio="none"
        viewBox="0 0 1440 56"
        className="pointer-events-none absolute inset-x-0 bottom-[-1px] z-10 block h-11 w-full text-dream-cream sm:h-14"
      >
        <path
          d="M0 28Q60 10 120 28 180 46 240 28 300 10 360 28 420 46 480 28 540 10 600 28 660 46 720 28 780 10 840 28 900 46 960 28 1020 10 1080 28 1140 46 1200 28 1260 10 1320 28 1380 46 1440 28L1440 56 0 56Z"
          fill="currentColor"
        />
      </svg>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Start options, the two ways to begin an order
// ────────────────────────────────────────────────────────────────────────────

function StartOptions() {
  const [designIt, quickQuote] = START_OPTIONS;
  return (
    <section className="mx-auto max-w-[1500px] px-6 pb-8 pt-20 lg:px-10 lg:pt-28">
      <div className="grid items-start gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
        {/* Left column, heading + intro only. */}
        <Reveal variant="up">
          <div className="lg:pt-4">
            <h2 className="font-display text-[56px] font-bold leading-[0.98] tracking-tight text-dream-ink lg:text-[84px]">
              Two ways
              <br />
              to start
            </h2>
            <p className="mt-10 max-w-[480px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
              Pick whichever fits how you like to work. Both land in the same
              place, with us reviewing your order and sending a proof. Not sure
              which one? Start a design to see live pricing and a mockup, or send
              a quick quote and we&apos;ll map out the details with you.
            </p>
          </div>
        </Reveal>

        {/* Right column, a bento of mixed-size tiles: the two start options,
            two studio photos, and a small accent tile. */}
        <Reveal variant="up" delay={120}>
          <div className="grid auto-rows-[104px] grid-cols-6 gap-3 sm:gap-4">
            {/* Option 1, large, top-left */}
            <Reveal
              variant="pop"
              className="col-start-1 col-span-4 row-start-1 row-span-3"
            >
              <BentoOption opt={designIt} className="h-full" />
            </Reveal>

            {/* Photo, top-right */}
            <div className="relative col-start-5 col-span-2 row-start-1 row-span-2 overflow-hidden rounded-[22px] ring-1 ring-dream-ink/10">
              <Image
                src="/custom-printed-tshirts-vancouver.jpeg"
                alt="Custom printed t-shirts from our Vancouver studio"
                fill
                sizes="(max-width: 1024px) 30vw, 260px"
                className="object-cover"
              />
            </div>

            {/* Accent, small, right */}
            <div className="col-start-5 col-span-2 row-start-3 row-span-1 flex items-center justify-center rounded-[22px] bg-dream-sun px-3 text-center">
              <span className="font-display text-[17px] font-extrabold leading-tight text-dream-ink">
                Printed in house
              </span>
            </div>

            {/* Photo, bottom-left */}
            <div className="relative col-start-1 col-span-2 row-start-4 row-span-2 overflow-hidden rounded-[22px] ring-1 ring-dream-ink/10">
              <Image
                src="/screen-printing-process-vancouver.jpeg"
                alt="Screen printing process in our Vancouver shop"
                fill
                sizes="(max-width: 1024px) 30vw, 260px"
                className="object-cover"
              />
            </div>

            {/* Option 2, wide, bottom-right */}
            <Reveal
              variant="pop"
              className="col-start-3 col-span-4 row-start-4 row-span-2"
            >
              <BentoOption opt={quickQuote} className="h-full" />
            </Reveal>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function BentoOption({
  opt,
  className,
}: {
  opt: StartOption;
  className: string;
}) {
  const purple = opt.tone === "purple";
  return (
    <div
      className={`flex flex-col rounded-[22px] p-6 shadow-[7px_7px_0_0_rgba(27,20,88,0.9)] ring-1 ring-dream-ink/10 transition-transform duration-300 ease-out hover:-translate-y-1 ${
        purple ? "bg-dream-lime text-dream-ink" : "bg-white text-dream-ink"
      } ${className}`}
    >
      <span
        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
          purple ? "bg-dream-ink text-white" : "bg-dream-sun text-dream-ink"
        }`}
      >
        <StartIcon name={opt.icon} />
      </span>
      <h3 className="mt-4 font-display text-[24px] font-bold leading-tight text-dream-ink">
        {opt.title}
      </h3>
      <p
        className={`mt-2 flex-1 text-[14px] leading-relaxed ${
          purple ? "text-dream-ink/75" : "text-dream-ink-soft"
        }`}
      >
        {opt.description}
      </p>
      <Link
        href={opt.href}
        className={`group mt-4 inline-flex w-fit items-center gap-2 rounded-full px-6 py-2.5 font-display text-[14px] font-bold transition-transform hover:-translate-y-0.5 ${
          purple ? "bg-dream-ink text-white" : "bg-dream-purple text-white"
        }`}
      >
        {opt.cta}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}

function StartIcon({ name }: { name: StartOption["icon"] }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-7 w-7",
    "aria-hidden": true,
  };
  if (name === "cart") {
    return (
      <svg {...common}>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M2.5 3h2.2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2L21.5 7H6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="5" y="4" width="14" height="17" rx="2.2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M8.5 12h7M8.5 16h5" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Good to know
// ────────────────────────────────────────────────────────────────────────────

const GOOD_TO_KNOW_ICONS = ["art", "layers", "clock"] as const;
const GOOD_TO_KNOW_CHIPS = [
  "bg-dream-purple text-white",
  "bg-dream-sun text-dream-ink",
  "bg-dream-peach text-dream-ink",
];

function GoodToKnowSection() {
  return (
    <section className="relative z-20 mx-auto max-w-[1400px] px-6 pb-10 pt-24 lg:px-10 lg:pb-16 lg:pt-32">
      <Reveal variant="up">
        <div className="mx-auto max-w-[680px] text-center">
          <h2 className="font-display text-[38px] font-bold leading-[1.02] tracking-tight text-dream-ink lg:text-[46px]">
            Good to know before you order
          </h2>
        </div>
      </Reveal>

      {/* One full card, pulled down with a negative margin so it overflows on
          top of the FAQ scallops in the section below. */}
      <Reveal variant="up" delay={120}>
        <div className="relative z-20 mt-10 -mb-20 rounded-[32px] bg-white p-7 shadow-[12px_12px_0_0_rgba(27,20,88,0.95)] ring-1 ring-dream-ink/10 sm:p-9 lg:-mb-28 lg:p-12">
          <div className="grid gap-9 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-dream-line">
            {GOOD_TO_KNOW.map((item, i) => (
              <div
                key={item.title}
                className="sm:px-8 sm:first:pl-0 sm:last:pr-0"
              >
                <span
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${GOOD_TO_KNOW_CHIPS[i]}`}
                >
                  <GoodIcon name={GOOD_TO_KNOW_ICONS[i]} />
                </span>
                <h3 className="mt-5 font-display text-[22px] font-bold leading-tight text-dream-ink">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-dream-ink-soft">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function GoodIcon({ name }: { name: (typeof GOOD_TO_KNOW_ICONS)[number] }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6",
    "aria-hidden": true,
  };
  if (name === "art") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="2.5" />
        <circle cx="8.5" cy="8.5" r="1.6" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    );
  }
  if (name === "layers") {
    return (
      <svg {...common}>
        <path d="M12 3l9 5-9 5-9-5 9-5Z" />
        <path d="M3 13l9 5 9-5" />
        <path d="M3 17l9 5 9-5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FAQ
// ────────────────────────────────────────────────────────────────────────────

function FAQ() {
  return (
    <section
      id="faq"
      className="relative bg-dream-lavender-soft pb-20 pt-48 lg:pb-24 lg:pt-64"
    >
      <svg
        aria-hidden="true"
        preserveAspectRatio="xMidYMid"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 block h-[28px] w-full"
      >
        <defs>
          <pattern
            id="hto-faq-scallop"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="0" rx="60" ry="28" fill="#f4f2ff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hto-faq-scallop)" />
      </svg>

      <div className="relative mx-auto grid max-w-[1300px] gap-8 px-6 lg:grid-cols-[1fr_1.3fr] lg:items-start lg:gap-16 lg:px-10">
        <div>
          <Reveal variant="up">
            <h2 className="font-display text-[38px] font-bold leading-[1.02] tracking-tight text-dream-ink md:text-[44px] lg:text-[48px]">
              Ordering questions
            </h2>
          </Reveal>
          <Reveal variant="up" delay={100}>
            <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-dream-ink-soft">
              A few quick answers. Have more?{" "}
              <Link
                href="/services#faq"
                className="font-semibold text-dream-purple underline-offset-2 hover:underline"
              >
                See the full FAQ
              </Link>{" "}
              or{" "}
              <Link
                href="/contact"
                className="font-semibold text-dream-purple underline-offset-2 hover:underline"
              >
                contact us
              </Link>
              .
            </p>
          </Reveal>
        </div>

        <FAQAccordion items={FAQS} />
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CTA
// ────────────────────────────────────────────────────────────────────────────

// Full-bleed CTA. It sticks to the top of the viewport so the footer below
// scrolls up and over it (a reveal effect), see the SiteFooter wrapper.
function CTA() {
  return (
    <section className="sticky bottom-0 z-0 flex min-h-[58vh] items-center justify-center overflow-hidden px-6 py-20">
      <Image
        src="/embroidery-machine-stitching-vancouver.jpeg"
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div aria-hidden className="absolute inset-0 bg-dream-ink/70" />

      <Reveal variant="up">
        <div className="relative z-10 mx-auto max-w-[720px] text-center text-white">
          <h2 className="font-display text-[44px] font-bold leading-[1.0] tracking-tight sm:text-6xl lg:text-[76px]">
            Ready when you are!
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[16px] leading-relaxed text-white/85 sm:text-lg">
            Start your design or send a quote request, and we&apos;ll take it
            from there.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/shop"
              className="rough-pill rough-pill-filled inline-flex items-center justify-center px-9 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Start your order
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border-2 border-white px-9 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5 hover:bg-white hover:text-dream-ink"
            >
              Contact us
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
