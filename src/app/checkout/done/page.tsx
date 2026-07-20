import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { HelpPrompt } from "@/components/support/HelpPrompt";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Order placed | Dreamhouse Printing" };

interface PlacedOrder {
  number: string;
  token: string | null;
  id: string | null;
}

/** Parse the `orders` param: comma-separated `number:token:id` triples. Older
 *  links carry only `number:token`, so `id` may be absent, handled gracefully. */
function parseOrders(raw: string | undefined): PlacedOrder[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((chunk) => {
      const [number, token, id] = chunk.split(":");
      if (!number) return null;
      return { number, token: token || null, id: id || null };
    })
    .filter((o): o is PlacedOrder => o !== null);
}

// Branded post-checkout handoff for guests AND signed-in customers. Rather than
// dropping a logged-in customer straight into their portal list, everyone lands
// here on a warm confirmation, then follows one clear CTA to the order itself.
export default async function CheckoutDonePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; orders?: string }>;
}) {
  const { order, orders: ordersRaw } = await searchParams;
  const user = await getUser();
  const isLoggedIn = !!user;

  const placed = parseOrders(ordersRaw);
  const multiple = placed.length > 1;
  const first = placed[0] ?? null;
  // Fall back to the legacy single `order` number if no triples were passed.
  const headerNumber = first?.number ?? order ?? null;

  // Where the primary CTA points. Signed-in customers go to their portal order
  // (or list); guests to the public order page keyed by the shareable token.
  function orderHref(o: PlacedOrder): string | null {
    if (isLoggedIn && o.id) return `/account/orders/${o.id}`;
    if (o.token) return `/o/${o.token}`;
    return null;
  }

  const singleHref = first ? orderHref(first) : null;
  const primaryHref = multiple ? (isLoggedIn ? "/account/orders" : null) : singleHref;
  const primaryLabel = multiple ? "Go to your orders" : "View your order";

  return (
    <div className="flex min-h-screen flex-col bg-dream-bg text-dream-ink">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-dream-success-soft text-dream-success">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
          {multiple ? "Order requests placed!" : "Order request placed!"}
        </h1>
        {!multiple && headerNumber && (
          <p className="mt-2 font-display text-lg font-bold text-dream-purple">{headerNumber}</p>
        )}
        <p className="mt-4 max-w-md text-dream-muted">
          Thanks! We&rsquo;ll email you a proof to approve before anything prints. No payment until then.
        </p>
        <p className="mt-2 text-sm text-dream-faint">
          Watch the inbox for the email you entered at checkout.
        </p>

        {/* When several designs were sent, list each order with its own link so
            nothing feels like a dead end. */}
        {multiple && (
          <ul className="mt-6 w-full space-y-2 text-left">
            {placed.map((o) => {
              const href = orderHref(o);
              return (
                <li
                  key={o.number}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dream-line bg-white px-4 py-3"
                >
                  <span className="font-display text-sm font-bold text-dream-ink">{o.number}</span>
                  {href ? (
                    <Link href={href} className="text-sm font-semibold text-dream-purple hover:text-dream-ink">
                      View order
                    </Link>
                  ) : (
                    <span className="text-xs text-dream-faint">Details in your email</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {primaryHref && (
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center rounded-full bg-dream-purple px-6 py-3 font-display text-sm font-bold text-white shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition-transform active:translate-y-[2px]"
            >
              {primaryLabel}
            </Link>
          )}
          {!isLoggedIn && (
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full border border-dream-line bg-white px-6 py-3 font-display text-sm font-bold text-dream-ink transition-colors hover:bg-dream-cream"
            >
              Create an account to track it
            </Link>
          )}
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-full border border-dream-line bg-white px-6 py-3 font-display text-sm font-bold text-dream-ink transition-colors hover:bg-dream-cream"
          >
            Keep shopping
          </Link>
        </div>

        <HelpPrompt
          title="Need to change something?"
          body="Reply to your confirmation email or reach out any time. A real person will help."
          className="mt-10 w-full text-left"
        />
      </main>
      <SiteFooter />
    </div>
  );
}
