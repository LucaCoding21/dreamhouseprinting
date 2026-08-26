"use client";

import { useEffect, useRef } from "react";
import { TESTIMONIALS } from "@/lib/testimonials";

/**
 * Endless carousel. The review list is rendered TWICE, so there is always an
 * identical card to the right of the last one and pressing next never
 * dead-ends. Once a scroll settles past the first copy we silently rewind by
 * exactly one copy's width; the content on both sides is identical, so the
 * jump is invisible and the arrows keep going in one direction forever.
 */
export default function Testimonials() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  /** Card-to-card distance (gap-agnostic) and the width of one full set. */
  function metrics(el: HTMLDivElement) {
    const cards = el.querySelectorAll<HTMLElement>("article");
    if (cards.length < 2) return { pitch: el.clientWidth * 0.8, copy: 0 };
    const pitch = cards[1].offsetLeft - cards[0].offsetLeft;
    return { pitch, copy: pitch * TESTIMONIALS.length };
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    // Debounced: rewinding mid-animation would cancel the smooth scroll, so
    // wait for it (or a finger swipe) to come to rest first.
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const { copy } = metrics(el);
        if (copy && el.scrollLeft >= copy) el.scrollLeft -= copy;
      }, 150);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, []);

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const { pitch, copy } = metrics(el);
    // Going back from the first card: hop forward one identical copy first, so
    // there is always something to the left to scroll into.
    if (dir === -1 && copy && el.scrollLeft < pitch) el.scrollLeft += copy;
    el.scrollBy({ left: pitch * dir, behavior: "smooth" });
  }

  return (
    /* pb leaves room for the footer dog peeking up; phones need far less of
       it than the taller desktop dog. */
    <section className="relative mx-auto max-w-[1700px] px-6 pb-28 pt-12 sm:pb-48 sm:pt-24 lg:px-12 lg:pb-56 lg:pt-32">
      <h2 className="text-center font-display text-[30px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-5xl">
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
          {/* Second copy is decorative: it exists only so the loop has runway,
              so it is hidden from screen readers to avoid repeated reviews. */}
          {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
            <article
              key={`${t.name}-${i}`}
              aria-hidden={i >= TESTIMONIALS.length || undefined}
              className="relative flex min-h-[340px] w-[85%] shrink-0 snap-start flex-col rounded-3xl px-6 py-7 shadow-[0_4px_0_0_rgba(27,20,88,0.08)] transition-transform duration-200 hover:-translate-y-1 sm:w-[55%] sm:px-7 sm:py-8 md:w-[calc((100%-2rem)/2.3)] lg:w-[calc((100%-3rem)/3.3)]"
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

              <p className="mt-6 font-display text-[14px] font-bold uppercase tracking-wide text-dream-ink">
               , {t.name}
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
