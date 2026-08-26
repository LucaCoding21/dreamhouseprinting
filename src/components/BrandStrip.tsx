/* eslint-disable @next/next/no-img-element */

// "Brands we print on", a continuous, auto-scrolling logo strip.
//
// The marquee works by rendering the SAME row of logos four times inside one
// flex track and animating the track by -50% (see .animate-brand-marquee in
// globals.css). The two halves of the track are identical (2 rows each), so
// when the animation loops the scroll never visibly jumps. Four copies (not
// two) so one half still covers ultra-wide viewports up to ~6400px.
//
// Logos live in /public/brands/{slug}.png. Drop official brand art in at the
// same path (same filename) to swap one out without touching this file.

type Brand = {
  slug: string;
  name: string;
};

const BRANDS: Brand[] = [
  { slug: "bella-canvas", name: "Bella+Canvas" },
  { slug: "gildan", name: "Gildan" },
  { slug: "comfort-colors", name: "Comfort Colors" },
  { slug: "next-level", name: "Next Level" },
  { slug: "independent", name: "Independent Trading Co." },
  { slug: "flexfit", name: "Flexfit" },
  { slug: "richardson", name: "Richardson" },
];

function LogoRow({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center gap-12 pr-12 sm:gap-16 sm:pr-16"
      aria-hidden={ariaHidden || undefined}
    >
      {BRANDS.map((brand) => (
        <li key={brand.slug} className="shrink-0">
          <img
            src={`/brands/${brand.slug}.png`}
            alt={ariaHidden ? "" : brand.name}
            loading="lazy"
            decoding="async"
            className="h-6 w-auto opacity-90 transition duration-200 hover:-translate-y-0.5 hover:opacity-100 sm:h-7"
          />
        </li>
      ))}
    </ul>
  );
}

export default function BrandStrip() {
  return (
    /* No border-t: the section above ends in white scallops that overlap this
       one, and a straight border drew a stray line across their base. */
    <section
      aria-label="Trusted by brands like these"
      className="bg-white pb-8 pt-8 sm:pb-12 sm:pt-12"
    >
      <p className="mb-12 text-center font-display text-[14px] font-semibold uppercase tracking-[0.015em] text-dream-ink/60 sm:mb-16 sm:text-sm sm:font-medium sm:text-dream-ink/40">
        Trusted by brands like these
      </p>

      {/* brand-marquee wrapper enables hover-to-pause; the edge masks fade the
          logos out at both ends so they don't hard-clip against the page. */}
      <div
        className="brand-marquee relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div className="animate-brand-marquee flex w-max">
          <LogoRow />
          <LogoRow ariaHidden />
          <LogoRow ariaHidden />
          <LogoRow ariaHidden />
        </div>
      </div>
    </section>
  );
}
