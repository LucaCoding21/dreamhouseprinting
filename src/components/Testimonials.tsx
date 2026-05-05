"use client";

import { useRef } from "react";

type Testimonial = {
  tag: string;
  headline: string;
  quote: string;
  name: string;
  bg: string;
  ink: string;
  tilt: number;
};

const TESTIMONIALS: Testimonial[] = [
  {
    tag: "Absolutely essential!",
    headline: "TEO'S REVIEW",
    quote:
      "Procured a large order of shirts, very pleased with the quality, service, and turnaround time. Would definitely order again!",
    name: "Teo Babienko",
    bg: "#f5d979",
    ink: "#1b1458",
    tilt: -2,
  },
  {
    tag: "Life saver",
    headline: "ETHAN'S TAKE",
    quote:
      "We got T-shirts printed from here for our event and I have to say that they are absolutely amazing. Prints came in no time and the quality is great.",
    name: "Ethan Bradford",
    bg: "#ffffff",
    ink: "#1b1458",
    tilt: 0,
  },
  {
    tag: "Fabulous service!",
    headline: "TORIN'S THOUGHTS",
    quote:
      "Staff are very responsive and accommodating. High quality materials and great result, thanks!",
    name: "Torin Lang",
    bg: "#bcd984",
    ink: "#1b1458",
    tilt: 2,
  },
  {
    tag: "Best in town",
    headline: "MAYA'S REVIEW",
    quote:
      "We ordered hoodies for our team retreat and the embroidery quality blew us away. Will be back for more.",
    name: "Maya Patel",
    bg: "#ffb091",
    ink: "#1b1458",
    tilt: -1,
  },
  {
    tag: "Quick and easy",
    headline: "JORDAN'S TAKE",
    quote:
      "Uploaded my design at noon and got a quote that same afternoon. Shirts showed up looking exactly like the proof.",
    name: "Jordan Lee",
    bg: "#ffffff",
    ink: "#1b1458",
    tilt: 1,
  },
  {
    tag: "Highly recommend",
    headline: "PRIYA'S THOUGHTS",
    quote:
      "Great communication start to finish. They caught a small detail I missed in my artwork and saved the run.",
    name: "Priya Singh",
    bg: "#cfc7ff",
    ink: "#1b1458",
    tilt: 2,
  },
];

export default function Testimonials() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector("article");
    const step = card ? card.clientWidth + 32 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  }

  return (
    <section className="relative mx-auto max-w-[1700px] px-6 pb-32 pt-24 lg:px-12 lg:pb-40 lg:pt-32">
      <h2 className="text-center font-display text-4xl font-bold text-dream-ink sm:text-5xl">
        Reviews
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-center text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
        Real words from teams, brands, and businesses we&apos;ve printed for.
      </p>

      <div className="relative mt-14">
        <div
          ref={scrollerRef}
          className="no-scrollbar -mx-2 flex snap-x snap-mandatory gap-6 overflow-x-auto px-2 py-6 md:gap-8"
        >
          {TESTIMONIALS.map((t) => (
            <article
              key={t.name}
              className="relative flex min-h-[340px] w-[85%] shrink-0 snap-start flex-col rounded-3xl px-6 py-7 shadow-[0_4px_0_0_rgba(27,20,88,0.08)] transition-transform duration-200 hover:-translate-y-1 sm:w-[55%] sm:px-7 sm:py-8 lg:w-[calc((100%-3rem)/3.3)]"
              style={{
                background: t.bg,
                color: t.ink,
                transform: `rotate(${t.tilt}deg)`,
              }}
            >
              <h3 className="font-daruma text-3xl leading-tight sm:text-[34px]">
                {t.headline}
              </h3>

              <div className="mt-3 flex gap-0.5 text-dream-sun">
                {[0, 1, 2, 3, 4].map((i) => (
                  <svg
                    key={i}
                    viewBox="0 0 20 20"
                    className="h-4 w-4 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M10 1.6l2.6 5.5 6.1.7-4.5 4.1 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7L10 1.6z" />
                  </svg>
                ))}
              </div>

              <p className="mt-4 flex-1 text-[16.5px] leading-[1.65] text-dream-ink/85 sm:text-[17px]">
                {t.quote}
              </p>

              <p className="mt-6 font-display text-[13px] font-bold uppercase tracking-wide text-dream-ink">
                — {t.name}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            aria-label="Previous reviews"
            onClick={() => scrollBy(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-dream-ink/15 bg-white text-dream-ink transition hover:border-dream-ink/40 hover:-translate-y-0.5"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next reviews"
            onClick={() => scrollBy(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-dream-ink/15 bg-white text-dream-ink transition hover:border-dream-ink/40 hover:-translate-y-0.5"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
