import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

/**
 * Branded 404. Without this, Next renders its bare white "404 | This page could
 * not be found" with no nav, which is exactly what a customer sees when an old
 * order link (/o/<token>) or a mistyped URL misses. Give them a way back.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-dream-bg">
      <SiteNav />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <Image
          src="/testimonailsplusfooter/dogasset.png"
          alt=""
          width={160}
          height={160}
          className="h-auto w-28 sm:w-36"
          priority
        />
        <p className="mt-6 font-display text-sm font-bold uppercase tracking-wide text-dream-purple">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-dream-ink sm:text-4xl" style={{ textWrap: "balance" }}>
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-dream-muted">
          The link may have expired or the address has a typo. If you were following an order link from an email, reply to
          that email and we&apos;ll send a fresh one.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rough-pill rough-pill-filled inline-flex items-center justify-center px-7 py-3 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Back to home
          </Link>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-full border border-dream-line bg-white px-7 py-3 font-display text-base font-bold text-dream-ink transition-colors hover:bg-dream-cream"
          >
            Browse the shop
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
