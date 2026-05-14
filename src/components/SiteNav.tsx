"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ScribbleButton from "./ScribbleButton";

const NAV_LINKS = [
  { label: "Services", href: "/services", rotate: -1 },
  { label: "About", href: "/about", rotate: 1 },
  { label: "Contact", href: "/contact", rotate: -0.5 },
];

// 12 rays on an ellipse around the Quick Quote pill.
// Each ray gets small length/angle jitter so they feel hand-drawn, not CAD.
const SUN_RAYS = Array.from({ length: 12 }, (_, i) => {
  const angle = i * 30;
  const rad = (angle * Math.PI) / 180;
  const rx = 110;
  const ry = 42;
  // Pseudo-random but stable per-index offsets.
  const lenJitter = [13, 11, 13, 12, 14, 10, 13, 12, 13, 11, 12, 12][i];
  const angleJitter = [-3, 4, -2, 5, -4, 2, -3, 4, -5, 3, -2, 4][i];
  return {
    x: +(Math.cos(rad) * rx).toFixed(1),
    y: +(Math.sin(rad) * ry).toFixed(1),
    r: angle + angleJitter,
    len: lenJitter,
    delay: +(((i * 83) % 450) / 1000).toFixed(2),
  };
});

export default function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  return (
    <header
      ref={headerRef}
      className="relative w-full px-5 py-[17px] lg:px-10 lg:py-[21px]"
    >
      <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
        <defs>
          <filter
            id="scribble-morph"
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.03"
              numOctaves="2"
              seed="1"
              result="noise"
            >
              <animate
                attributeName="seed"
                values="1;3;5;7;9;11"
                dur="0.75s"
                repeatCount="indefinite"
                calcMode="discrete"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" />
          </filter>
        </defs>
      </svg>

      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/dreamhouse-logo.svg"
            alt="Dreamhouse Printing"
            width={140}
            height={140}
            priority
            className="h-14 w-14 lg:h-16 lg:w-16"
          />
          <span className="hidden font-display font-extrabold leading-[1.05] text-dream-purple lg:inline lg:text-[26px]">
            Dreamhouse
            <br />
            Printing
          </span>
        </Link>

        <div className="flex items-center gap-4 lg:gap-10">
          <nav className="hidden items-center gap-3 xl:flex">
            {NAV_LINKS.map((link) => (
              <ScribbleButton
                key={link.href}
                href={link.href}
                rotate={link.rotate}
              >
                {link.label}
              </ScribbleButton>
            ))}
          </nav>

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
                  width: `${ray.len}px`,
                } as CSSProperties
              }
            />
          ))}
          <Link
            href="/#quick-quote"
            className="rough-pill rough-pill-filled relative inline-flex items-center justify-center px-5 py-2.5 font-display text-[15px] font-bold text-white transition-transform hover:-translate-y-0.5 lg:px-8 lg:py-3.5 lg:text-[17px]"
          >
            Quick Quote
          </Link>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-dream-scribble xl:hidden"
          >
            <span className="relative flex h-5 w-7 flex-col justify-between">
              <span
                className={`block h-[2.5px] w-full origin-center rounded-full bg-current transition-transform duration-300 ease-out ${
                  menuOpen ? "translate-y-[8.75px] rotate-45" : ""
                }`}
              />
              <span
                className={`block h-[2.5px] w-full rounded-full bg-current transition-opacity duration-200 ease-out ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`block h-[2.5px] w-full origin-center rounded-full bg-current transition-transform duration-300 ease-out ${
                  menuOpen ? "-translate-y-[8.75px] -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <nav
        aria-hidden={!menuOpen}
        className={`absolute left-0 right-0 top-full z-50 flex origin-top flex-col items-stretch gap-2 border-t border-dream-lavender-soft bg-dream-cream px-5 py-3 shadow-lg transition-all duration-300 ease-out xl:hidden ${
          menuOpen
            ? "translate-y-0 scale-y-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-y-95 opacity-0"
        }`}
      >
        {NAV_LINKS.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMenuOpen(false)}
            className={`rounded-lg px-4 py-3 font-display text-lg font-bold text-dream-scribble transition-all duration-300 ease-out hover:bg-dream-lavender-soft ${
              menuOpen
                ? "translate-y-0 opacity-100"
                : "-translate-y-1 opacity-0"
            }`}
            style={{ transitionDelay: menuOpen ? `${i * 60 + 80}ms` : "0ms" }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
