"use client";

import type { CSSProperties } from "react";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ScribbleButton from "./ScribbleButton";
import { AccountIcon } from "./AccountIcon";
import CartNavButton from "./CartNavButton";
import { BRANDS, brandHref } from "@/lib/brands";

const NAV_LINKS = [
  { label: "Shop All", href: "/shop", rotate: 1 },
  { label: "Brands", href: "/brands", rotate: -0.75 },
  { label: "Services", href: "/services", rotate: -1 },
  { label: "How to Order", href: "/how-to-order", rotate: -0.5 },
  { label: "About", href: "/about", rotate: 1 },
  { label: "Contact", href: "/contact", rotate: 0.5 },
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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [spacerH, setSpacerH] = useState<number | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const lastScrollY = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
    setSearchOpen(false);
    setSearchQuery("");
  }

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (searchOpen) closeSearch();
        else setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen, searchOpen]);

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

  // The header is `fixed` (out of flow), so a spacer below it reserves its
  // height. Measure the real header instead of hardcoding, the scribble-button
  // links row renders taller than its raw padding, and the height shifts with
  // breakpoints and the search open/closed state.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setSpacerH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Hide nav on scroll-down, reveal on scroll-up, on all viewports. The
  // header is `fixed` at every breakpoint so the transform always applies.
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
      className={`fixed inset-x-0 top-0 z-50 w-full border-b border-dream-ink/15 bg-dream-lavender-soft px-5 transition-transform duration-300 ease-out xl:px-10 ${
        shouldHide ? "-translate-y-full" : "translate-y-0"
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

      <div className="relative z-50 mx-auto max-w-[1600px]">
        {/* Row 1: logo · nav links · search · sign-in · CTA.
            The logo and the icon cluster are equal flex-1 wings, so the link
            row sits in the true center of the bar. When a wing's content
            outgrows its half (tight xl widths), flex lets the wings go
            unequal and the links nudge off-center instead of overlapping. */}
        <div className="flex items-center gap-4 pt-6 pb-6 xl:pt-6 xl:pb-6">
          <div className="flex min-w-0 flex-1 items-center justify-start">
            {/* shrink-0: the logo must never be the flex item that gives way
                when the row runs tight, it was getting crushed on laptops. */}
            <Link href="/" className="flex shrink-0 items-center pr-4 2xl:pr-8">
              <Image
                src="/dreamhouse-logo-nav.svg"
                alt="Dreamhouse Printing"
                width={457}
                height={298}
                priority
                className="h-14 w-auto lg:h-[80px] xl:h-[60px] 2xl:h-[72px]"
              />
            </Link>
          </div>

          {/* Nav links, desktop only, centered between the wings. */}
          <nav
            aria-label="Main"
            className="hidden shrink-0 items-center gap-1.5 xl:flex 2xl:gap-3"
          >
            {NAV_LINKS.map((link) =>
              link.label === "Brands" ? (
                // Hover (or keyboard focus) reveals the brand list; clicking the
                // label itself navigates to the /brands index page.
                <div key={link.href} className="group relative">
                  <ScribbleButton href={link.href} rotate={link.rotate}>
                    <span className="inline-flex items-center gap-1.5">
                      {link.label}
                      <ChevronDownIcon className="h-3 w-3 transition-transform duration-200 group-hover:rotate-180" />
                    </span>
                  </ScribbleButton>
                  {/* Transparent pt-2 keeps the hover region continuous from
                      the trigger into the panel (no dead gap that drops hover). */}
                  <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    <div className="w-64 rounded-2xl border-2 border-dream-purple/20 bg-white p-2 shadow-[0_8px_0_0_rgba(118,100,255,0.12)]">
                      <ul className="flex flex-col">
                        {BRANDS.map((b) => (
                          <li key={b.brand}>
                            <Link
                              href={brandHref(b.brand)}
                              className="block rounded-xl px-4 py-2.5 font-display text-[15px] font-medium text-dream-ink transition-colors hover:bg-dream-lavender-soft hover:text-dream-purple"
                            >
                              {b.label}
                            </Link>
                          </li>
                        ))}
                        <li className="mt-1 border-t border-dream-ink/10 pt-1">
                          <Link
                            href={link.href}
                            className="block rounded-xl px-4 py-2.5 font-display text-[15px] font-bold text-dream-purple transition-colors hover:bg-dream-lavender-soft"
                          >
                            All brands
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <ScribbleButton
                  key={link.href}
                  href={link.href}
                  rotate={link.rotate}
                >
                  {link.label}
                </ScribbleButton>
              ),
            )}
          </nav>

          <div className="relative flex flex-1 items-center justify-end gap-3 lg:gap-4 xl:gap-2.5 2xl:gap-4">
            {/* Search slot, reserves the open width at 2xl so toggling never
                shifts the icon cluster. Below 2xl there's no room to
                reserve: the open form overlays the icon cluster instead
                (absolute, anchored to this cluster's right edge). */}
            <div className="flex w-auto justify-end 2xl:w-72">
            {searchOpen ? (
              <form
                onSubmit={handleSearch}
                role="search"
                className="flex h-11 w-64 items-center gap-2.5 rounded-full border-2 border-dream-purple/25 bg-white pl-4 pr-1.5 shadow-sm focus-within:border-dream-purple focus-within:ring-2 focus-within:ring-dream-purple/25 max-2xl:absolute max-2xl:right-0 max-2xl:top-1/2 max-2xl:z-20 max-2xl:-translate-y-1/2 max-2xl:shadow-md sm:w-72 2xl:w-full"
              >
                <SketchSearchIcon className="h-[22px] w-[22px] shrink-0 text-dream-purple/55" />
                <input
                  ref={searchInputRef}
                  type="search"
                  name="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shirts, hoodies, hats…"
                  aria-label="Search the catalog"
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dream-ink placeholder:text-dream-purple/40 focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={closeSearch}
                  className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-dream-purple/70 transition-colors hover:bg-dream-purple/10 hover:text-dream-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
                >
                  <SketchCloseIcon className="h-[17px] w-[17px]" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                aria-label="Search the catalog"
                onClick={openSearch}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-dream-purple transition-transform hover:-translate-y-0.5 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
              >
                {/* Icon sizes here are tuned to read at the same weight as the
                    hamburger beside them (a 28px glyph), each nudged for its
                    own viewBox padding rather than sharing one number. */}
                <SketchSearchIcon className="h-[28px] w-[28px]" />
              </button>
            )}
            </div>

            {/* Cart */}
            <CartNavButton />

            {/* Account */}
            <Link
              href="/account"
              aria-label="Your account"
              title="Your account"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-dream-purple transition-transform hover:-translate-y-0.5 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
            >
              <AccountIcon className="h-[25px] w-[25px]" />
            </Link>

            {/* Quick Quote CTA, desktop only */}
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
                className="rough-pill rough-pill-filled relative inline-flex items-center justify-center px-5 py-2.5 font-display text-[15px] font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                Quick Quote
              </Link>
            </div>

            {/* Hamburger, mobile / tablet only */}
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-dream-scribble xl:hidden"
            >
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
      </div>
    </header>

    {/* Full-screen mobile menu, kept OUTSIDE <header> because the header is
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

    {/* Spacer reserves the nav's height since the header is `fixed` at every
        breakpoint. The ResizeObserver measurement takes over after hydration;
        these fallbacks only cover the first paint, so they must EQUAL the real
        header height (logo height + 48px padding + 1px border) or everything
        below the nav renders shifted up under the fixed header until JS runs
        (the price-match banner was getting clipped 33px at lg). */}
    <div
      aria-hidden="true"
      style={spacerH != null ? { height: spacerH } : undefined}
      className="h-[105px] lg:h-[129px] xl:h-[109px] 2xl:h-[121px]"
    />
    </>
  );
}

/** Hand-drawn magnifying glass, a wobbly circle that overshoots where it
 *  closes (a classic sketched cue) so it reads as a doodle, matching the
 *  brand's rough aesthetic. */
function SketchSearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M13.1 4.5C8.9 3.7 5 6.7 5 10.5c0 3.6 3.2 6.4 6.8 5.8 3.3-.5 5.5-4 4.5-7.2-.6-2.1-2.6-3.9-5.1-4.4" />
      <path d="M15.3 14.7c1.6 1.4 3.1 2.9 4.7 4.6" />
    </svg>
  );
}

/** Hand-drawn chevron, a single wobbly down-stroke for the Brands dropdown
 *  cue, matching the sketched aesthetic. */
function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 8.5c2.6 2.7 4.8 5 7 7.2 2.2-2.2 4.5-4.6 7-7.4" />
    </svg>
  );
}

/** Hand-drawn close (X), two gently curved strokes so it looks sketched
 *  rather than geometric. */
function SketchCloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6.4 6.1c3.8 3.8 7.6 7.7 11.3 11.7" />
      <path d="M17.6 6.3c-3.7 3.9-7.5 7.7-11.2 11.6" />
    </svg>
  );
}
