import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { BRANDS, brandHref } from "@/lib/brands";

export const metadata: Metadata = {
  title: "Brands | Dreamhouse Printing",
  description:
    "The garment brands we print on, from budget Gildan basics to premium Comfort Colors and Bella+Canvas. Pick a brand to browse its blanks.",
};

export default function BrandsPage() {
  return (
    <main className="min-h-screen bg-dream-cream">
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>

      {/* ---- Hero band ---- */}
      <section className="relative overflow-hidden bg-dream-lavender-soft">
        <div className="relative z-10 mx-auto max-w-[106rem] px-4 pb-24 pt-10 sm:px-6 sm:pb-28 sm:pt-14">
          <h1 className="font-display font-extrabold text-4xl leading-[0.95] tracking-tight text-dream-ink sm:text-5xl lg:text-6xl">
            The Brands We Print
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-dream-ink-soft">
            From budget basics to premium garment-dyed favourites, pick a brand to browse the blanks we stock for it.
          </p>
        </div>
        <HeroWave />
      </section>

      {/* ---- Brand grid ---- */}
      <section className="relative mx-auto -mt-16 max-w-[106rem] px-4 pb-20 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BRANDS.map((b) => (
            <Link
              key={b.brand}
              href={brandHref(b.brand)}
              className="group flex flex-col rounded-2xl border-2 border-dream-line bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-dream-lavender hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
            >
              <h2 className="font-display text-xl font-bold text-dream-ink group-hover:text-dream-purple">
                {b.label}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-dream-ink-soft">{b.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1 font-display text-sm font-bold text-dream-purple">
                Browse {b.label}
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
                  &rarr;
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/shop"
            className="inline-flex h-11 items-center rounded-full bg-dream-purple px-6 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Shop all products
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function HeroWave() {
  return (
    <svg
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-60 w-full text-dream-cream sm:h-[18rem]"
      viewBox="0 0 1440 240"
      fill="none"
      preserveAspectRatio="none"
    >
      <path
        d="M0 36C220 14 380 8 480 10 600 13 680 24 760 50 830 76 870 108 940 108 1010 108 1040 84 1120 84 1200 84 1245 150 1330 162 1385 168 1418 185 1440 192V240H0Z"
        fill="currentColor"
      />
    </svg>
  );
}
