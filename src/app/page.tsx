import Link from "next/link";
import HeroImage from "@/components/HeroImage";
import HowItWorks from "@/components/HowItWorks";
import QuoteCard from "@/components/QuoteCard";
import ShopByCategories from "@/components/ShopByCategories";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import Testimonials from "@/components/Testimonials";

const SITE_URL = "https://www.dreamhouseprinting.com";

const LOCAL_BUSINESS_LD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#business`,
  name: "Dreamhouse Printing",
  url: SITE_URL,
  image: `${SITE_URL}/dreamhouse-logo-full.png`,
  logo: `${SITE_URL}/dreamhouse-logo-full.png`,
  email: "admin@dreamhouseprinting.com",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    streetAddress: "323 Alexander St",
    addressLocality: "Vancouver",
    addressRegion: "BC",
    postalCode: "V6A 1C4",
    addressCountry: "CA",
  },
  areaServed: [
    { "@type": "City", name: "Vancouver" },
    { "@type": "City", name: "Burnaby" },
    { "@type": "City", name: "Richmond" },
    { "@type": "City", name: "Surrey" },
    { "@type": "City", name: "North Vancouver" },
  ],
  // Mon–Fri 10am–6pm, closed weekends. Keep in sync with the Google Business
  // Profile — mismatched hours hurt local trust signals.
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "10:00",
      closes: "18:00",
    },
  ],
  // No aggregateRating/review markup: self-hosted, self-rated reviews aren't
  // eligible for review rich results and risk a structured-data spam penalty.
  // Testimonials still render on-page (see <Testimonials />) for conversion.
};

export default function Home() {
  return (
    <main className="min-h-screen bg-dream-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_LD) }}
      />
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>

      <Link
        href="/contact#coastal-reign"
        className="block bg-[#c6ff3d] text-[#8f55e5] transition hover:brightness-95"
      >
        <p className="mx-auto max-w-[1400px] px-4 py-2 text-center text-[12px] font-bold sm:px-6 sm:text-[15px]">
          {/* Condensed on mobile to avoid an awkward wrap, but still pulls both
              competitor names (Coastal Reign / Get Bold) — those are the hook. */}
          <span className="sm:hidden">
            We price match Coastal Reign &amp; Get Bold and{" "}
            <span className="font-display font-extrabold uppercase tracking-wide">beat it by 5%</span>
          </span>
          <span className="hidden sm:inline">
            We price match Coastal Reign and Get Bold! Submit a request and we&apos;ll{" "}
            <span className="font-display font-extrabold uppercase tracking-wide">beat it by 5%</span>
          </span>
        </p>
      </Link>

      <section className="mx-auto max-w-[1500px] px-6 pb-0 pt-0 md:px-8 lg:px-10 lg:pb-8 lg:pt-0">
        <div className="grid items-center gap-1 lg:grid-cols-[1fr_1.1fr] lg:gap-4">
          <div className="-mt-[84px] order-2 text-center lg:mt-0 lg:order-none lg:pl-10 lg:text-left">
            <h1 className="pt-14 font-display text-[30px] font-bold leading-[1.1] tracking-tight text-dream-ink sm:text-[40px] lg:pt-14 lg:text-[60px]">
              We do quality custom Screenprinting and Embroidery right here in Vancouver.
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-dream-ink-soft mx-auto lg:mt-8 lg:mx-0 lg:text-[17px]">
              Premium custom apparel for Vancouver businesses, teams, and brands. Upload your design, get a quote in minutes. Thanks for coming by!
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              {/* Mobile/tablet: single primary CTA pointing at the instant
                  quote calculator on this page. Desktop keeps the original
                  two buttons (Start your order + outline Get a quick quote). */}
              <a
                href="#quick-quote"
                className="rough-pill rough-pill-filled rough-pill-lean inline-flex items-center justify-center px-8 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5 lg:hidden"
              >
                Get a quick quote
              </a>
              <a
                href="#quick-quote"
                className="rough-pill rough-pill-filled rough-pill-lean hidden items-center justify-center px-10 py-5 font-display text-lg font-bold text-white transition-transform hover:-translate-y-0.5 lg:inline-flex"
              >
                Start your order
              </a>
              <a
                href="#quick-quote"
                className="rough-pill rough-pill-outline rough-pill-lean hidden items-center justify-center px-10 py-5 font-display text-lg font-bold text-dream-purple transition-transform hover:-translate-y-0.5 lg:inline-flex"
              >
                Get a quick quote
              </a>
            </div>
          </div>

          <div className="relative mx-auto mb-12 mt-8 max-w-[380px] order-1 sm:mb-0 sm:mt-0 sm:-mx-6 sm:max-w-none lg:order-none lg:mx-0 lg:-mt-16 lg:translate-x-18 md:mx-auto md:max-w-[520px]">
            <HeroImage />
          </div>
        </div>

        <div className="mt-12 flex justify-center lg:mt-24">
          <a
            href="#how-it-works"
            className="group flex flex-col items-center gap-2 text-dream-purple transition-transform hover:-translate-y-0.5"
          >
            <span className="hidden font-display text-[14px] font-bold uppercase tracking-[0.12em] lg:inline-block">
              See how it works
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-9 w-9 overflow-visible group-hover:animate-bounce"
              style={{ filter: "url(#stroke-rough)" }}
            >
              {/* Hand-drawn chevron — two subtle bezier curves through the
                  apex, warped by the same #stroke-rough filter the hamburger
                  uses so it reads as a pen stroke. */}
              <path d="M 5.4 9.3 C 7.6 11, 10 13, 12 14.9 C 14 13, 16.4 11, 18.6 9.3" />
            </svg>
          </a>
        </div>
      </section>

      <HowItWorks />
      <ShopByCategories />
      <QuoteCard />
      <Testimonials />
      <SiteFooter />
    </main>
  );
}
