"use client";

import { useState, type MouseEvent } from "react";
import Reveal from "@/components/Reveal";

type Item = { q: string; a: string };

export default function FAQAccordion({ items }: { items: Item[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function handleSummaryClick(e: MouseEvent<HTMLElement>, i: number) {
    e.preventDefault();
    setOpenIndex((prev) => (prev === i ? null : i));
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <Reveal key={item.q} variant="up" delay={i * 40}>
          <details
            open={openIndex === i}
            className="faq-accordion rough-card group relative px-6 py-5"
          >
            <summary
              onClick={(e) => handleSummaryClick(e, i)}
              className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-base font-bold text-dream-ink sm:text-lg"
            >
              <span>{item.q}</span>
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dream-purple font-display text-xl leading-none text-white transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-4 whitespace-pre-line pr-10 text-[14px] leading-relaxed text-dream-ink-soft sm:text-[15px]">
              {item.a}
            </p>
          </details>
        </Reveal>
      ))}
    </div>
  );
}
