"use client";

import { useEffect, useRef, useState } from "react";

type Options = {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
};

// IntersectionObserver-backed reveal hook. Returns a ref + a `revealed` flag
// that flips true when the target has scrolled into view. Pair with the
// reveal-* CSS variants in globals.css.
export function useReveal<T extends HTMLElement = HTMLDivElement>(opts: Options = {}) {
  const { threshold = 0.2, rootMargin = "0px 0px -20% 0px", once = true } = opts;
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            if (once) obs.unobserve(entry.target);
          } else if (!once) {
            setRevealed(false);
          }
        }
      },
      { threshold, rootMargin },
    );
    obs.observe(el);

    // Safety net: if IO never fires (errors, hidden ancestor, etc.) reveal
    // anyway after a delay so content is never permanently invisible.
    const timer = window.setTimeout(() => setRevealed(true), 1500);

    return () => {
      obs.disconnect();
      window.clearTimeout(timer);
    };
  }, [threshold, rootMargin, once]);

  return { ref, revealed };
}
