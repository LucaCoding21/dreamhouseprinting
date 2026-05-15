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
  const [hidden, setHidden] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!menuOpen) return;
    // Escape closes the menu. We don't register a pointerdown-outside-header
    // listener because the full-screen backdrop <button> already handles
    // "tap outside menu items to close" — and the listener would race the
    // link's click event, sometimes swallowing navigation.
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  // Lock body scroll while the full-screen mobile menu is open so the page
  // underneath doesn't bleed through when the user drags.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Mobile: hide nav on scroll-down, reveal on scroll-up. Desktop ignores
  // the transform since the header is `xl:relative`.
  useEffect(() => {
    lastScrollY.current = window.scrollY;
    const onScroll = () => {
      const current = window.scrollY;
      const delta = current - lastScrollY.current;
      if (current <= 80) {
        setHidden(false);
      } else if (delta > 4) {
        setHidden(true);
      } else if (delta < -4) {
        setHidden(false);
      }
      lastScrollY.current = current;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Opening the menu forces the nav visible, so closing it doesn't leave
  // the user staring at a header sliding away.
  useEffect(() => {
    if (menuOpen) setHidden(false);
  }, [menuOpen]);

  const shouldHide = hidden && !menuOpen;

  return (
    <>
    <header
      ref={headerRef}
      className={`fixed inset-x-0 top-0 z-50 w-full bg-dream-lavender-soft px-5 py-1.5 transition-transform duration-300 ease-out xl:relative xl:bg-transparent xl:px-10 xl:py-3 ${
        shouldHide ? "-translate-y-full xl:translate-y-0" : "translate-y-0"
      }`}
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

      <div className="relative z-50 mx-auto flex max-w-[1400px] items-center justify-between gap-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/dreamhouse-logo-full.png"
            alt="Dreamhouse Printing"
            width={1800}
            height={600}
            priority
            className="h-14 w-auto lg:h-[100px]"
          />
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

          <div className="sun-burst relative hidden xl:inline-block">
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
            {/* Hand-drawn hamburger. Each "line" is two stacked paths:
                a fatter, low-opacity "ink bleed" underlay (pressure variation)
                + a crisp top stroke with a subtle dash pattern (tiny ink
                skips). All paths pass through #stroke-rough for pen-tremor
                wobble. Each line has its own resting tilt and uneven endpoints
                so the three don't read as machine-aligned. */}
            {/* Sketchy hamburger: one clean stroke per line, with subtle bezier
                curves + tiny resting tilts so the three don't read as machine
                aligned, plus the rough filter for a hand-drawn wobble. */}
            <svg
              viewBox="0 0 28 22"
              aria-hidden="true"
              className="h-7 w-9 overflow-visible"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "url(#stroke-rough)" }}
            >
              <path
                d="M 2 3.5 C 9 2.5, 19 4.2, 26 3"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  transform: menuOpen
                    ? "translateY(7.5px) rotate(44deg)"
                    : "rotate(-2deg)",
                  transition: "transform 320ms ease-out",
                }}
              />
              <path
                d="M 2 11 C 9 11.7, 19 10.3, 26 11.4"
                style={{
                  opacity: menuOpen ? 0 : 1,
                  transition: "opacity 180ms ease-out",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  transform: "rotate(1.5deg)",
                }}
              />
              <path
                d="M 2 18.5 C 9 19.6, 19 17.8, 26 19"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  transform: menuOpen
                    ? "translateY(-7.5px) rotate(-46deg)"
                    : "rotate(1deg)",
                  transition: "transform 320ms ease-out",
                }}
              />
            </svg>
          </button>
        </div>
      </div>
    </header>

    {/* Full-screen mobile menu — kept OUTSIDE <header> because the header is
        `fixed` with a `transform` (scroll-hide), which would otherwise create
        a containing block and confine this fixed sheet to the header's box.
        Header sits at z-50 above this z-40 sheet so the hamburger stays
        tappable as the close button. */}
      <div
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 xl:hidden ${
          menuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={menuOpen ? 0 : -1}
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 h-full w-full bg-dream-lavender-soft transition-opacity duration-[450ms] ease-out ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <nav
          aria-label="Main"
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-7 px-6 pb-36 pt-36 sm:pb-44 sm:pt-44"
        >
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`font-daruma text-[56px] leading-none text-dream-purple sm:text-[72px] ${
                menuOpen ? "pointer-events-auto" : "pointer-events-none"
              }`}
              style={{
                rotate: `${link.rotate * 3}deg`,
                scale: menuOpen ? 1 : 0.4,
                opacity: menuOpen ? 1 : 0,
                transition: `scale 550ms cubic-bezier(0.34, 1.56, 0.64, 1) ${
                  menuOpen ? i * 90 + 120 : 0
                }ms, opacity 350ms ease ${
                  menuOpen ? i * 90 + 120 : 0
                }ms`,
              }}
            >
              {link.label}
            </Link>
          ))}

          <div
            className={`sun-burst relative mt-4 inline-block ${
              menuOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
            style={{
              scale: menuOpen ? 1 : 0.4,
              opacity: menuOpen ? 1 : 0,
              transition: `scale 600ms cubic-bezier(0.34, 1.56, 0.64, 1) ${
                menuOpen ? NAV_LINKS.length * 90 + 200 : 0
              }ms, opacity 350ms ease ${
                menuOpen ? NAV_LINKS.length * 90 + 200 : 0
              }ms`,
            }}
          >
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
              onClick={() => setMenuOpen(false)}
              className="rough-pill rough-pill-filled relative inline-flex items-center justify-center px-9 py-3.5 font-display text-[17px] font-bold text-white"
            >
              Quick Quote
            </Link>
          </div>
        </nav>
      </div>

    {/* Spacer reserves the nav's height on mobile (header is `fixed`).
        Hidden on desktop where the header is back to `relative`. */}
    <div aria-hidden="true" className="h-[68px] lg:h-[88px] xl:hidden" />
    </>
  );
}
