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

      <div className="bg-dream-purple text-white">
        <p className="mx-auto max-w-[1400px] px-6 py-2 text-center text-[15px] font-medium">
          We price match Coastal Reign and Get Bold! Submit a request and we&apos;ll beat it by 5%
        </p>
      </div>

      <section className="mx-auto max-w-[1550px] px-6 pb-6 pt-2 lg:px-10 lg:pb-8 lg:pt-3">
        <div className="grid items-center gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-4">
          <div className="lg:-mt-12 lg:pl-10">
            <h1 className="font-display text-[44px] font-semibold leading-[1.05] tracking-tight text-black sm:text-[56px] lg:text-[68px]">
              Custom screen printing and embroidery, done right.
            </h1>
            <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-dream-ink-soft">
              Premium apparel for businesses, teams, and brands in Vancouver. Upload your design, get a quote in minutes.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/quote"
                className="rough-pill rough-pill-filled rough-pill-lean inline-flex items-center justify-center px-10 py-5 font-display text-lg font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                Start your order
              </Link>
              <Link
                href="/#quick-quote"
                className="rough-pill rough-pill-outline rough-pill-lean inline-flex items-center justify-center px-10 py-5 font-display text-lg font-bold text-dream-purple transition-transform hover:-translate-y-0.5"
              >
                Get a quick quote
              </Link>
            </div>
          </div>

          <div className="relative">
            <Image
              src="/homepage_assets/hero_photo.webp"
              alt="Custom printed apparel: sweatshirt, tote bag, hat, and t-shirt on a hand-drawn purple background"
              width={1600}
              height={1607}
              priority
              sizes="(min-width: 1024px) 700px, 100vw"
              className="h-auto w-full max-h-[520px] object-contain lg:max-h-[560px]"
            />
          </div>
        </div>

        <div className="-mt-2 flex justify-center lg:-mt-8">
          <a
            href="#how-it-works"
            className="group flex flex-col items-center gap-2 text-dream-purple transition-transform hover:-translate-y-0.5"
          >
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.12em]">
              See how it works
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 animate-bounce"
            >
              <path d="M6 9l6 6 6-6" />
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
