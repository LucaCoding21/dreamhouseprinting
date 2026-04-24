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
        <p className="mx-auto max-w-[1400px] px-6 py-2 text-center text-[13px] font-medium">
          We price match Coastal Reign and Get Bold! Submit a request and we&apos;ll beat it by 5%
        </p>
      </div>

      <section className="mx-auto max-w-[1400px] px-6 py-6 lg:px-10 lg:py-4">
        <div className="grid items-center gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-black sm:text-5xl lg:text-[60px]">
              Custom screen printing
              <br className="hidden lg:block" />
              <span className="lg:hidden"> </span>and embroidery, done
              <br className="hidden lg:block" />
              <span className="lg:hidden"> </span>right.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-dream-ink-soft">
              Premium apparel for businesses, teams, and brands in Vancouver.
              <br className="hidden sm:block" />
              Upload your design, get a quote in minutes.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Link
                href="/quote"
                className="rough-pill rough-pill-filled rough-pill-lean inline-flex items-center justify-center px-8 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                Start your order
              </Link>
              <Link
                href="/quote"
                className="rough-pill rough-pill-outline rough-pill-lean inline-flex items-center justify-center px-8 py-4 font-display text-base font-bold text-dream-purple transition-transform hover:-translate-y-0.5"
              >
                Get a quick quote
              </Link>
            </div>
          </div>

          <div className="relative">
            <Image
              src="/homepage_assets/hero_photo.png"
              alt="Custom printed apparel: sweatshirt, tote bag, hat, and t-shirt on a hand-drawn purple background"
              width={1200}
              height={1200}
              priority
              className="h-auto w-full"
            />
          </div>
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
