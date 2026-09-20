"use client";

import { useId, useState } from "react";
import Reveal from "@/components/Reveal";

type Item = { q: string; a: string };

/* Open/close animates via grid-template-rows 0fr -> 1fr on a wrapper, which
   is the one height-to-auto transition every browser supports (the previous
   ::details-content + interpolate-size version was Chrome-only, so Safari and
   every iPhone snapped). The answer stays in the DOM, hidden from readers and
   the tab order while closed. */
export default function FAQAccordion({ items }: { items: Item[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const open = openIndex === i;
        const panelId = `${baseId}-panel-${i}`;
        return (
          <Reveal key={item.q} variant="up" delay={i * 40}>
            <div className="rough-card relative px-6 py-5">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex((prev) => (prev === i ? null : i))}
                className="flex w-full cursor-pointer items-center justify-between gap-6 text-left font-display text-base font-bold text-dream-ink sm:text-lg"
              >
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dream-purple font-display text-xl leading-none text-white transition-transform duration-300 ${
                    open ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-hidden={!open}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] ${
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <p
                    className="mt-4 whitespace-pre-line pr-10 text-[14px] leading-relaxed text-dream-ink-soft sm:text-[15px]"
                    // Keep the closed answer out of the tab order / a11y tree.
                    inert={!open}
                  >
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
