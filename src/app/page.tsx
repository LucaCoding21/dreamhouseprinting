import Image from "next/image";
import Link from "next/link";
import HowItWorks from "@/components/HowItWorks";
import QuickQuote from "@/components/QuickQuote";
import ShopByCategories from "@/components/ShopByCategories";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import Testimonials from "@/components/Testimonials";

export default function Home() {
  return (
    <main className="min-h-screen bg-dream-cream">
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>

      <div className="hidden bg-[#8f55e5] text-white sm:block">
        <p className="mx-auto max-w-[1400px] whitespace-nowrap px-4 py-2 text-center text-[12px] font-medium sm:whitespace-normal sm:px-6 sm:text-[15px]">
          <span className="hidden sm:inline">We price match Coastal Reign and Get Bold! Submit a request and we&apos;ll beat it by 5%</span>
        </p>
      </div>

      <section className="mx-auto max-w-[1550px] px-6 pb-0 pt-2 md:px-8 md:pb-8 md:pt-2 lg:px-10 lg:pb-8 lg:pt-3">
        <div className="grid items-center gap-1 md:grid-cols-[1.1fr_1fr] md:gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-4">
          <div className="-mt-[68px] order-2 text-center md:mt-0 md:order-none md:pl-4 md:text-left lg:-mt-4 lg:pl-10">
            <h1 className="pt-2 font-display text-[44px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[60px] md:pt-0 md:text-[68px] lg:text-[80px]">
              <span className="block md:inline">Custom</span>{" "}
              <span className="block md:inline">screen printing</span>
              <span className="block">and embroidery<span className="hidden md:inline">.</span></span>
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-dream-ink-soft mx-auto md:mt-8 md:mx-0 md:text-[17px]">
              Premium apparel for businesses, teams, and brands in Vancouver. Upload your design, get a quote in minutes.
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
            <Image
              src="/homepage_assets/hero_photo.webp"
              alt="Custom printed apparel: sweatshirt, tote bag, hat, and t-shirt on a hand-drawn purple background"
              width={1600}
              height={1607}
              priority
              sizes="(min-width: 1024px) 700px, (min-width: 768px) 50vw, 100vw"
              className="h-auto w-full max-h-[760px] object-contain sm:max-h-[780px] md:max-h-[700px] lg:max-h-[740px]"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-center md:-mt-6 lg:-mt-8">
          <a
            href="#how-it-works"
            className="group flex flex-col items-center gap-2 text-dream-purple transition-transform hover:-translate-y-0.5"
          >
            <span className="hidden font-display text-[11px] font-bold uppercase tracking-[0.12em] md:inline-block">
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
              className="h-7 w-7 animate-bounce overflow-visible"
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
