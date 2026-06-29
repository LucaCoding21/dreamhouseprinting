import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata = { title: "Order placed — Dreamhouse Printing" };

// Public guest confirmation. Guests have no account, so this only shows the
// order number + reassurance (it loads no order data). Logged-in customers land
// on /account/orders/[id] instead.
export default async function CheckoutDonePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <div className="min-h-screen bg-dream-bg text-dream-ink">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-dream-success-soft text-dream-success">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">Order request placed!</h1>
        {order && (
          <p className="mt-2 font-display text-lg font-bold text-dream-purple">{order}</p>
        )}
        <p className="mt-4 max-w-md text-dream-muted">
          Thanks! We’ve got your design. Our team reviews and cleans up your artwork, then emails you a proof to approve
          before anything prints. No payment is taken until then.
        </p>
        <p className="mt-2 text-sm text-dream-faint">Keep an eye on the inbox for the email you entered at checkout.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-full bg-dream-purple px-6 py-3 font-display text-sm font-bold text-white shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition-transform active:translate-y-[2px]"
          >
            Keep shopping
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full border border-dream-line bg-white px-6 py-3 font-display text-sm font-bold text-dream-ink transition-colors hover:bg-dream-cream"
          >
            Create an account to track it
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
