import type { CSSProperties } from "react";
import Image from "next/image";

type Step = {
  n: number;
  title: string;
  description: string;
  blob: string;
  blobWidth: number;
  blobHeight: number;
  // Rotation applied to the blob only (in degrees)
  blobRotate?: number;
  // Single animated WebP (preserves alpha, ~150-250KB vs ~10-17MB of PNG frames).
  dog: string;
  dogAlt: string;
  dogWidth: string;
  // Optional vertical/horizontal nudge (CSS length) for when an asset's internal
  // composition doesn't center nicely inside the blob.
  dogOffsetY?: string;
  dogOffsetX?: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "Tell us what you need",
    description:
      "Pick your products and upload your art, you'll get a quick instant quote",
    blob: "/how it works/1blob.svg",
    blobWidth: 255,
    blobHeight: 310,
    blobRotate: -12,
    dog: "/how it works/step-1-upload-design.webp",
    dogAlt: "Dog sitting next to a folded shirt and paw-print food bowl",
    dogWidth: "500px",
    dogOffsetX: "30px",
  },
  {
    n: 2,
    title: "We send you a proof",
    description:
      "We'll double check your timeline, stock, and print to make sure it's ready to go. If it looks good, you're all good to pay!",
    blob: "/how it works/2blob.svg",
    blobWidth: 317,
    blobHeight: 255,
    dog: "/how it works/step-2-proof-review.webp",
    dogAlt: "Dog peeking out of a canvas tote bag with rolled artwork",
    dogWidth: "450px",
    dogOffsetY: "24px",
  },
  {
    n: 3,
    title: "Printing begins",
    description: "Once you approve, we get to screenprinting your order in house.",
    blob: "/how it works/3blob.svg",
    blobWidth: 322,
    blobHeight: 299,
    dog: "/how it works/step-3-printing.webp",
    dogAlt: "Dog giving an approving thumbs up",
    dogWidth: "520px",
    dogOffsetY: "30px",
  },
  {
    n: 4,
    title: "It's at your door",
    description:
      "Printed, packed and shipped, or grab it in Vancouver!",
    blob: "/how it works/1blob.svg",
    blobWidth: 255,
    blobHeight: 310,
    dog: "/how it works/step-4-delivered.webp",
    dogAlt: "Dog trotting with a shopping bag marked with a paw print",
    dogWidth: "510px",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative mx-auto max-w-[1550px] px-6 pb-32 pt-12 sm:pt-28 lg:px-10 lg:pb-40 lg:pt-0">
      {/* Mobile-only scallops at the bottom edge — white bumps coming up
          from the next section (ShopByCategories, bg-white) into HIW.
          Matches the pattern used on /contact and /services. */}
      <svg
        aria-hidden="true"
        preserveAspectRatio="xMidYMid"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 block h-[28px] w-full lg:hidden"
      >
        <defs>
          <pattern
            id="hiw-bottom-scallop"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="28" rx="60" ry="28" fill="#ffffff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hiw-bottom-scallop)" />
      </svg>
      <h2 className="mt-6 text-center font-display text-[38px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-4xl lg:mt-10">
        How It Works
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-base text-dream-ink-soft sm:text-lg">
        From idea to doorstep in four easy steps. Quote, proof, approve, and we deliver.
      </p>

      <div className="relative mt-4 grid gap-6 sm:grid-cols-2 sm:gap-20 lg:mt-6 lg:grid-cols-4 lg:gap-28">
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          {[
            { i: 1, width: "13%", left: "24%", top: "90px", rotate: 0 },
            { i: 2, width: "17%", left: "53%", top: "115px", rotate: 4 },
            { i: 3, width: "13%", left: "81%", top: "90px", rotate: -10 },
          ].map(({ i, width, left, top, rotate }) => (
            <Image
              key={i}
              src={`/how it works/strokes/stroke${i}.png`}
              alt=""
              aria-hidden="true"
              width={300}
              height={120}
              className="absolute h-auto"
              style={{
                left,
                top,
                width,
                transform: `translateX(-50%) rotate(${rotate}deg)`,
              }}
            />
          ))}
        </div>

        {STEPS.map((step) => (
          <div
            key={step.n}
            className="relative flex min-w-0 flex-col items-center overflow-x-clip text-center lg:overflow-x-visible"
          >
            <div className="relative flex h-[340px] w-full max-w-[460px] items-center justify-center sm:h-[400px] lg:h-[440px]">
              <div
                className={`relative z-10 flex items-center justify-center scale-[0.7] sm:scale-100 sm:translate-x-[var(--dog-ox)] sm:translate-y-[var(--dog-oy)] ${
                  step.n === 1 ? "max-sm:-translate-x-1" : ""
                }`}
                style={
                  {
                    "--dog-ox": step.dogOffsetX ?? "0px",
                    "--dog-oy": step.dogOffsetY ?? "0px",
                  } as CSSProperties
                }
              >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={step.dog}
                alt={step.dogAlt}
                loading="lazy"
                decoding="async"
                className="relative z-10 h-auto max-w-none shrink-0"
                style={{ width: step.dogWidth }}
              />
              </div>
            </div>

            <h3 className="-mt-4 font-daruma text-[30px] text-dream-ink sm:text-3xl">
              {step.title}
            </h3>

            <p
              className={`mt-3 max-w-[320px] text-[14px] leading-relaxed text-dream-ink-soft ${
                step.n === 2 ? "lg:w-[120%]" : ""
              }`}
            >
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
