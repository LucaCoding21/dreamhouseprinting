"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import Reveal from "@/components/Reveal";

type OrderStep = {
  n: number;
  title: string;
  blurb: string;
  // Card surface + text tokens (dream-* only).
  cardClass: string;
  titleClass: string;
  ruleClass: string;
  bulletClass: string;
  // Big watermark numeral bleeding off the bottom-left corner.
  carvedClass: string;
  // Fanned-deck geometry, applied only at lg.
  rotate: string;
  shift: string;
  z: number;
};

const ORDER_STEPS: OrderStep[] = [
  {
    n: 1,
    title: "Tell us what you need",
    blurb: "Design online or send a quick quote, then upload your art. You'll get an instant price.",
    cardClass: "bg-dream-peach",
    titleClass: "text-dream-ink",
    ruleClass: "text-dream-ink/70",
    bulletClass: "text-dream-ink",
    carvedClass: "text-dream-ink/10",
    rotate: "-6deg",
    shift: "20px",
    z: 10,
  },
  {
    n: 2,
    title: "We send you a proof",
    blurb: "We check your timeline, stock, and print, then email a proof for you to approve.",
    cardClass: "bg-dream-lavender",
    titleClass: "text-dream-ink",
    ruleClass: "text-dream-ink/70",
    bulletClass: "text-dream-ink",
    carvedClass: "text-dream-ink/10",
    rotate: "4deg",
    shift: "0px",
    z: 20,
  },
  {
    n: 3,
    title: "You approve and pay",
    blurb: "Approve the proof, pay by card or e-transfer, and we start printing.",
    cardClass: "bg-dream-sun",
    titleClass: "text-dream-ink",
    ruleClass: "text-dream-ink/70",
    bulletClass: "text-dream-ink",
    carvedClass: "text-dream-ink/10",
    rotate: "-3deg",
    shift: "18px",
    z: 30,
  },
  {
    n: 4,
    title: "It's at your door",
    blurb: "Printed and packed in house, then shipped to you or ready for Vancouver pickup.",
    cardClass: "bg-dream-purple",
    titleClass: "text-dream-cream",
    ruleClass: "text-dream-cream/90",
    bulletClass: "text-dream-cream",
    carvedClass: "text-white/15",
    rotate: "6deg",
    shift: "2px",
    z: 40,
  },
];

export default function HowToOrderSteps() {
  // Clicking a card brings it to the front of the fanned stack and keeps it
  // there until another card is clicked.
  const [frontN, setFrontN] = useState<number | null>(null);

  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-[1880px] px-6 pb-20 pt-16 sm:pb-32 sm:pt-32 lg:px-10 lg:pb-40 lg:pt-48"
    >
      <Reveal variant="up">
        <div className="mx-auto max-w-[640px] text-center">
          <h2 className="font-display text-[30px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[38px] lg:text-[46px]">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
            Four simple steps from first idea to doorstep. No back-and-forth,
            no surprises.
          </p>
        </div>
      </Reveal>

      {/* The fanned deck. Rotation + vertical shift live in CSS vars and only
          apply at lg (you can't override an inline transform with a class), so
          the cards stack upright and unrotated on mobile. Cards overlap via
          negative margins at lg and layer left-to-right so the 1 to 4 order reads. */}
      <div className="mt-12 flex flex-col items-center gap-8 sm:mt-14 lg:mt-16 lg:flex-row lg:items-start lg:justify-center lg:gap-0">
          {ORDER_STEPS.map((step, i) => (
            <div
              key={step.n}
              onClick={() => setFrontN(step.n)}
              // z-index applies from lg ONLY: it exists to order the fanned,
              // overlapping deck. Below lg the cards are a plain vertical
              // stack that never overlaps, and an always-on inline z-index
              // outranked the mobile menu sheet (z-40), so a tapped card
              // rendered on top of the open menu. The raised value stays under
              // the nav's z-50 so a card can't cover the header either.
              className={`relative w-full max-w-full shrink-0 [transform:none] sm:w-[290px] lg:z-[var(--z)] lg:w-[410px] lg:[transform:rotate(var(--r))_translateY(var(--ty))] ${
                i === 0 ? "" : "lg:-ml-8"
              }`}
              style={
                {
                  "--r": step.rotate,
                  "--ty": step.shift,
                  "--z": frontN === step.n ? 45 : step.z,
                } as CSSProperties
              }
            >
              <Reveal variant="pop" delay={i * 130}>
              <div
                className={`relative flex min-h-0 cursor-pointer flex-col items-center rounded-[28px] px-6 pb-6 pt-6 text-center sm:min-h-[360px] sm:px-8 sm:pb-10 sm:pt-9 shadow-[7px_7px_0_0_rgba(27,20,88,0.9)] transition-[transform,box-shadow] duration-100 active:translate-x-[4px] active:translate-y-[4px] active:shadow-[3px_3px_0_0_rgba(27,20,88,0.9)] ${step.cardClass}`}
              >
                {/* Carved step numeral, bleeds off the bottom-left corner. It
                    lives in its own clip layer so only the numeral is clipped to
                    the card shape; the card itself never clips its text. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]"
                >
                  <span
                    className={`absolute -bottom-6 left-1 select-none font-daruma text-[150px] leading-none sm:-bottom-8 sm:text-[210px] ${step.carvedClass}`}
                  >
                    {step.n}
                  </span>
                </div>

                {/* Content sits above the carved numeral, centred. */}
                <div className="relative z-10 flex flex-1 flex-col items-center">
                  {/* Title, the dominant element. */}
                  <h3 className={`font-daruma text-[34px] leading-[0.95] tracking-tight sm:text-[38px] lg:whitespace-nowrap lg:text-[27px] ${step.titleClass}`}>
                    {step.title}
                  </h3>

                  {/* Hand-drawn squiggle underline. */}
                  <svg
                    aria-hidden
                    viewBox="0 0 88 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className={`mt-4 h-3 w-[88px] sm:mt-5 ${step.ruleClass}`}
                  >
                    <path d="M2 7 Q 12.5 1, 23 7 T 44 7 T 65 7 T 86 7" />
                  </svg>

                  {/* Supporting detail, one clean descriptive line. */}
                  <p className={`mt-4 max-w-full text-[16px] font-medium leading-[1.65] sm:mt-5 sm:max-w-[290px] ${step.bulletClass}`}>
                    {step.blurb}
                  </p>
                </div>
              </div>
              </Reveal>
            </div>
          ))}
        </div>
    </section>
  );
}
