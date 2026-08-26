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
import { formatCAD } from "@/lib/money";

/** One type-ahead row from /api/search. */
type Suggestion = {
  id: string;
  name: string;
  brand: string | null;
  image: string | null;
  price: number;
};

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
  // Phones get a different search treatment (a rule-underlined bar dropped
  // below the nav row) so it needs its own ref; only one of the two is ever
  // on screen, and focusing a display:none input is a no-op, so open focuses
  // both and the visible one wins.
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);
  // Type-ahead suggestions for the phone search bar. /api/search runs the same
  // query the /shop page does, so the list and the page it leads to agree.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
    setSearchOpen(false);
    setSearchQuery("");
  }

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => {
      mobileSearchRef.current?.focus();
      searchInputRef.current?.focus();
    }, 50);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setSuggestions([]);
  }

  // Debounced so a fast typist fires one request, not one per keystroke; the
  // AbortController drops any reply that a newer query has already superseded.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!searchOpen || q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const ac = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });
        const data = (await res.json()) as { results?: Suggestion[] };
        setSuggestions(data.results ?? []);
      } catch {
        // Aborted or offline: leave whatever is on screen rather than flashing
        // an empty state at someone mid-keystroke.
      } finally {
        if (!ac.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => {
      ac.abort();
      clearTimeout(t);
    };
  }, [searchQuery, searchOpen]);

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

  // Tapping anywhere outside the search drawer closes it. The listener sits on
  // the header element, so a tap on the nav row itself (the magnifier, the cart)
  // is left to its own handler instead of being swallowed here.
  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const header = headerRef.current;
      if (header && !header.contains(e.target as Node)) closeSearch();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [searchOpen]);

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

  // The two are alternative modes, so opening one puts the other away. Raising
  // the menu sheet's z-index instead would cover the header, and the header is
  // where the hamburger that closes the sheet lives.
  useEffect(() => {
    if (menuOpen && searchOpen) closeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            Logo and links sit together on the left; the icon cluster is the
            only flex-1 wing, so it takes the slack and pins to the right. */}
        {/* Phones get a shorter bar: at 105px the nav was eating 16% of an
            iPhone SE, which pushed the hero CTA under the fold. */}
        <div className="flex items-center gap-2 pt-4 pb-4 sm:gap-4 sm:pt-6 sm:pb-6 xl:pt-6 xl:pb-6">
          {/* The logo wing used to be flex-1, which paired with the icon wing to
              centre the links. Dropping flex-1 lets the links sit right beside
              the logo while the icon cluster still pushes to the right edge. */}
          <div className="flex min-w-0 shrink-0 items-center justify-start">
            {/* shrink-0: the logo must never be the flex item that gives way
                when the row runs tight, it was getting crushed on laptops. */}
            {/* Two files, not one scaled logo: the phone gets the compact mark
                (472x493, near square) and md+ gets the full lockup with the
                wordmark (1208x493). Both render, one is hidden per breakpoint,
                so there is no layout shift and no client-side width check.
                The lockup is ~3.2:1, so it eats far more width per unit of
                height than the old 1.53:1 logo; there is slack between the links and
                the icon cluster at xl+, and the wing is shrink-0, so it can
                run bigger than the old one without squeezing the row. */}
            <Link href="/" className="flex shrink-0 items-center pr-2 sm:pr-4 2xl:pr-8">
              <Image
                src="/dreamhouse-logo-mark-v2.svg"
                alt="Dreamhouse Printing"
                width={498}
                height={508}
                priority
                className="h-12 w-auto md:hidden"
              />
              <Image
                src="/dreamhouse-logo-wide-v2.svg"
                alt="Dreamhouse Printing"
                width={1579}
                height={493}
                priority
                className="hidden h-[56px] w-auto md:block lg:h-[68px] xl:h-[58px] 2xl:h-[72px]"
              />
            </Link>
          </div>

          {/* Nav links, desktop only, centered between the wings. */}
          <nav
            aria-label="Main"
            className={`hidden shrink-0 items-center gap-1.5 transition-opacity xl:flex xl:pl-2 2xl:gap-3 2xl:pl-4 ${
              searchOpen ? "max-2xl:pointer-events-none max-2xl:opacity-0" : ""
            }`}
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

          <div className="relative flex min-w-0 flex-1 items-center justify-end gap-1.5 min-[400px]:gap-3 lg:gap-4 xl:gap-2.5 2xl:gap-4">
            {/* Search slot. At 2xl the OPEN form takes static width (2xl:w-72
                only while open, so the closed state never reserves 288px and
                squeezes the bar at the xl->2xl seam). Below 2xl the open form
                overlays the icon cluster instead (absolute, anchored to this
                cluster's right edge). */}
            <div
              className={`flex w-auto shrink-0 justify-end ${
                searchOpen ? "2xl:w-72" : ""
              }`}
            >
            {searchOpen ? (
              <>
              <form
                onSubmit={handleSearch}
                role="search"
                className="hidden h-11 w-64 items-center gap-2.5 rounded-full border-2 border-dream-purple/25 bg-white pl-4 pr-1.5 shadow-sm focus-within:border-dream-purple focus-within:ring-2 focus-within:ring-dream-purple/25 md:flex max-2xl:absolute max-2xl:right-0 max-2xl:top-1/2 max-2xl:z-50 max-2xl:-translate-y-1/2 max-2xl:shadow-md sm:w-72 2xl:w-full"
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
                  // WebKit draws its own clear "x" inside a type=search field as
                  // soon as it has text, which sat beside our Close button and
                  // read as two X's. Ours stays, the native one is suppressed.
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dream-ink placeholder:text-dream-purple/40 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
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
              {/* Phone: the icon never leaves the row and never changes shape,
                  it just toggles the bar shut. */}
              <button
                type="button"
                aria-label="Close search"
                onClick={closeSearch}
                className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-dream-purple md:hidden"
              >
                <SketchSearchIcon className="h-[25px] w-[25px]" />
              </button>
              </>
            ) : (
              <button
                type="button"
                aria-label="Search the catalog"
                onClick={openSearch}
                className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-dream-purple transition-transform hover:-translate-y-0.5 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
              >
                {/* Icon sizes here are tuned to read at the same weight as the
                    hamburger beside them (a 28px glyph), each nudged for its
                    own viewBox padding rather than sharing one number.
                    The translate-y aligns the glyphs on a common BOTTOM line:
                    each one's art ends at a different height inside its own
                    viewBox (magnifier handle 20.3/24, bag 20.7/24, account
                    16.4/17, hamburger ~21/22), so simply centring them left
                    four different baselines. Offsets are measured against the
                    hamburger, the lowest-sitting of the four. */}
                <SketchSearchIcon className="h-[25px] w-[25px] translate-y-[2px] sm:h-[28px] sm:w-[28px] sm:translate-y-[3px]" />
              </button>
            )}
            </div>

            {/* Cart */}
            <CartNavButton />

            {/* Account. On phones this opens in a new tab so browsing isn't
                lost: the portal is a separate task from shopping, and an
                in-progress cart or design should still be there afterwards.
                Decided at click time rather than with a static target, because
                rendering target from a media query would differ between server
                and client and break hydration. Modified clicks are left to the
                browser. */}
            <Link
              href="/account"
              aria-label="Your account"
              title="Your account"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                if (window.matchMedia("(max-width: 767px)").matches) {
                  e.preventDefault();
                  window.open("/account", "_blank", "noopener,noreferrer");
                }
              }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-dream-purple transition-transform hover:-translate-y-0.5 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
            >
              <AccountIcon className="h-[21px] w-[21px] translate-y-[1px] sm:h-[25px] sm:w-[25px]" />
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
                className="rough-pill rough-pill-filled relative inline-flex items-center justify-center whitespace-nowrap px-5 py-2.5 font-display text-[15px] font-bold text-white transition-transform hover:-translate-y-0.5"
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
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-dream-purple xl:hidden"
            >
              <svg
                viewBox="0 0 28 22"
                aria-hidden="true"
                className="h-6 w-7 overflow-visible sm:h-7 sm:w-9"
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

        {/* Phone search: a full-width field under the nav row, underlined by a
            single rule. The pill that used to overlay the icon cluster covered
            the cart and account on a narrow screen. */}
      </div>

        {searchOpen && (
          // Absolutely positioned UNDER the header, not inside its flow: the
          // page reserves the header's measured height, so a band in flow
          // shoved every page down by its height when search opened. Here it
          // floats over the content instead, which is what a search drawer
          // should do.
          <div className="absolute inset-x-0 top-full z-40 border-b border-dream-ink/15 bg-dream-cream px-5 pb-4 pt-4 shadow-[0_10px_24px_-16px_rgba(27,20,88,0.4)] md:hidden xl:px-10">
            <form onSubmit={handleSearch} role="search" className="relative">
              <input
                ref={mobileSearchRef}
                type="search"
                name="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                aria-label="Search the catalog"
                className="w-full border-0 border-b-[1.5px] border-dream-purple/35 bg-transparent pb-1.5 pr-9 font-display text-base font-medium text-dream-ink placeholder:text-dream-purple/45 focus:border-dream-purple focus:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
              />
              {/* Sits inside the field, over the rule's right end. Clears the
                  query and keeps the bar open, so it is not the same control as
                  the magnifier in the nav row (which closes the drawer). */}
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  mobileSearchRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute bottom-0.5 right-0 flex h-9 w-9 items-center justify-center text-dream-purple/75 transition-colors hover:text-dream-purple"
              >
                {/* Same colour as the rule it sits on, a touch heavier: at the
                    rule's own 1.5px a diagonal cross reads thinner than a
                    horizontal line of the same width. */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </form>

            {searchQuery.trim().length >= 2 && (
              <div className="mt-3">
                {suggestions.length > 0 ? (
                  <>
                    <ul className="divide-y divide-dream-purple/12">
                      {suggestions.map((r) => (
                        <li key={r.id}>
                          <Link
                            href={`/shop/${r.id}`}
                            onClick={closeSearch}
                            className="flex items-center gap-3.5 py-3"
                          >
                            {/* The image is sized by its own ratio and centred by
                                this flex parent; stretching it to the tile and
                                letterboxing left the artwork looking off-centre. */}
                            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1.5 ring-1 ring-dream-purple/15">
                              {r.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.image} alt="" className="max-h-full max-w-full object-contain" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-display text-sm font-semibold text-dream-ink">
                                {r.name}
                              </span>
                              <span className="mt-0.5 block text-[14px] font-semibold text-dream-purple">
                                {formatCAD(r.price)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={(e) => handleSearch(e as unknown as React.FormEvent<HTMLFormElement>)}
                      className="mt-1.5 block w-full py-2.5 text-center font-display text-sm font-bold text-dream-purple underline decoration-dream-purple/45 decoration-[1.5px] underline-offset-4"
                    >
                      See all results for &ldquo;{searchQuery.trim()}&rdquo;
                    </button>
                  </>
                ) : (
                  <p className="py-3 text-sm text-dream-ink/60">
                    {searching ? "Searching…" : `No products match "${searchQuery.trim()}"`}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
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

        {/* Scrollable sheet. The safe-center pattern (outer scroll container +
            inner m-auto block, NOT justify-center, which clips the leading edge
            once content overflows) keeps every link reachable on short
            viewports (320x568 portrait, landscape phones). Link size and gaps
            scale with svh so the menu rarely needs to scroll at all. Clicks on
            the empty space around the links still close the menu. */}
        <nav
          aria-label="Main"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMenuOpen(false);
          }}
          className={`absolute inset-0 z-10 flex flex-col overflow-y-auto overscroll-contain ${
            menuOpen ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setMenuOpen(false);
            }}
            className="m-auto flex flex-col items-center gap-[clamp(16px,3svh,28px)] px-6 pb-24 pt-20 sm:pb-32 sm:pt-24"
          >
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`whitespace-nowrap text-center font-daruma text-[clamp(30px,min(9svh,10vw),56px)] leading-none text-dream-purple sm:text-[clamp(36px,11svh,72px)] ${
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
              className="rough-pill rough-pill-filled relative inline-flex items-center justify-center px-12 py-5 font-display text-[22px] font-bold text-white"
            >
              Quick Quote
            </Link>
          </div>
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
      className="h-[77px] sm:h-[105px] lg:h-[129px] xl:h-[109px] 2xl:h-[121px]"
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
