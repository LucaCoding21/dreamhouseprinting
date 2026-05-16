import Link from "next/link";
import HeroImage from "@/components/HeroImage";
import HowItWorks from "@/components/HowItWorks";
import QuickQuote from "@/components/QuickQuote";
import ShopByCategories from "@/components/ShopByCategories";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import Testimonials from "@/components/Testimonials";
import { TESTIMONIALS } from "@/lib/testimonials";

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
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    bestRating: "5",
    reviewCount: TESTIMONIALS.length,
  },
  review: TESTIMONIALS.map((t) => ({
    "@type": "Review",
    author: { "@type": "Person", name: t.name },
    reviewBody: t.quote,
    reviewRating: {
      "@type": "Rating",
      ratingValue: "5",
      bestRating: "5",
    },
    itemReviewed: { "@id": `${SITE_URL}/#business` },
  })),
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

      <div className="hidden bg-[#c6ff3d] text-[#8f55e5] sm:block">
        <p className="mx-auto max-w-[1400px] whitespace-nowrap px-4 py-2 text-center text-[12px] font-bold sm:whitespace-normal sm:px-6 sm:text-[15px]">
          <span className="hidden sm:inline">
            We price match Coastal Reign and Get Bold! Submit a request and we&apos;ll{" "}
            <span className="font-display font-extrabold uppercase tracking-wide">beat it by 5%</span>
          </span>
        </p>
      </div>

      <section className="mx-auto max-w-[1550px] px-6 pb-0 pt-0 md:px-8 md:pb-8 md:pt-0 lg:px-10 lg:pb-8 lg:pt-0">
        <div className="grid items-center gap-1 md:grid-cols-[1.15fr_1fr] md:gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-4">
          <div className="-mt-[84px] order-2 text-center md:-mt-24 md:order-none md:pl-4 md:text-left lg:-mt-36 lg:pl-10">
            <h1 className="pt-14 font-display text-[30px] font-bold leading-[1.1] tracking-tight text-dream-ink sm:text-[40px] md:pt-20 md:text-[50px] lg:pt-24 lg:text-[60px]">
              We do quality custom Screenprinting and Embroidery right here in Vancouver.
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-dream-ink-soft mx-auto md:mt-8 md:mx-0 md:text-[17px]">
              Premium custom apparel for Vancouver businesses, teams, and brands. Upload your design, get a quote in minutes. Thanks for coming by!
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 md:justify-start">
              {/* Mobile: single primary CTA pointing at the instant quote
                  calculator on this page. Desktop keeps the original two
                  buttons (Start your order + outline Get a quick quote). */}
              <a
                href="#quick-quote"
                className="rough-pill rough-pill-filled rough-pill-lean inline-flex items-center justify-center px-8 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5 md:hidden"
              >
                Get a quick quote
              </a>
              <Link
                href="/quote"
                className="rough-pill rough-pill-filled rough-pill-lean hidden items-center justify-center px-10 py-5 font-display text-lg font-bold text-white transition-transform hover:-translate-y-0.5 md:inline-flex"
              >
                Start your order
              </Link>
              <a
                href="#quick-quote"
                className="rough-pill rough-pill-outline rough-pill-lean hidden items-center justify-center px-10 py-5 font-display text-lg font-bold text-dream-purple transition-transform hover:-translate-y-0.5 md:inline-flex"
              >
                Get a quick quote
              </a>
            </div>
          </div>

          <div className="relative -mx-6 order-1 md:order-none md:mx-0">
            <HeroImage />
          </div>
        </div>

        <div className="mt-12 flex justify-center md:-mt-4 lg:-mt-8">
          <a
            href="#how-it-works"
            className="group flex flex-col items-center gap-2 text-dream-purple transition-transform hover:-translate-y-0.5"
          >
            <span className="hidden font-display text-[14px] font-bold uppercase tracking-[0.12em] md:inline-block">
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
      <QuickQuote />
      <Testimonials />
      <SiteFooter />
    </main>
  );
}
