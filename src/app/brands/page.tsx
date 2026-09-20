import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { BrandsBrowser } from "./BrandsBrowser";

export const metadata: Metadata = {
  title: "Brands | Dreamhouse Printing",
  description:
    "The garment brands we print on, from budget Gildan basics to premium Comfort Colors and Bella+Canvas. Pick a brand to browse its blanks.",
};

export default function BrandsPage() {
  return (
    <main className="min-h-dvh bg-dream-bg">
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>

      <section className="relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-[52rem] px-5 pb-20 pt-10 sm:px-8 sm:pt-14 lg:max-w-[76rem] lg:px-10 lg:pt-20">
          <p className="font-display text-[14px] font-bold uppercase tracking-[0.18em] text-dream-purple">
            Our brands
          </p>
          <h1 className="mt-3 font-display text-[34px] font-extrabold leading-[1.05] tracking-tight text-dream-ink sm:text-5xl lg:text-6xl">
            The Brands We Print
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-dream-ink-soft sm:text-base lg:max-w-xl">
            From budget basics to premium garment-dyed favourites, pick a brand to
            browse the blanks we stock for it.
          </p>

          <BrandsBrowser />

          <div className="mt-10 flex justify-center">
            <Link
              href="/shop"
              className="inline-flex h-11 items-center rounded-full bg-dream-purple px-6 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Shop all products
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

