import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { formatCAD } from "@/lib/money";
import { STATUS_META, orderStatusLabel } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/rows";

export interface SiblingOrder {
  number: string;
  token: string;
  /** Product name, or "Product + N more" when the order spans several. */
  title: string;
  pieces: number;
  colours: string[];
  total: number | null;
  mockup: string | null;
  status: OrderStatus;
}

/**
 * Shown at the top of a public order page when the customer just checked out a
 * cart holding several designs. The lite cart places one order per design, so a
 * single checkout can produce several order numbers; we land the customer on
 * the first one and use this to hand them the rest.
 *
 * Each sibling gets a real card (mockup, product, pieces, total, status) rather
 * than a bare order number, because an order number means nothing to a customer
 * looking at their own artwork.
 *
 * Siblings are resolved server-side from their tokens, never from the URL text,
 * so everything shown is the real record.
 *
 * This is a checkout affordance, not a property of the order: it rides on a
 * query param and disappears on reload. That is fine, every order also emails
 * its own link, and signed-in customers see them all in the portal.
 */
export function SiblingOrdersBanner({
  current,
  currentToken,
  siblings,
}: {
  current: string | null;
  currentToken: string;
  siblings: SiblingOrder[];
}) {
  if (siblings.length === 0) return null;
  const total = siblings.length + 1;

  // Each link hands the whole set forward, minus the order it points at, so the
  // banner survives hopping between orders instead of stranding the customer on
  // whichever one they clicked.
  const href = (target: string) => {
    const rest = [currentToken, ...siblings.map((s) => s.token)].filter((t) => t !== target);
    return `/o/${target}${rest.length ? `?also=${rest.join(",")}` : ""}`;
  };

  return (
    <div className="rounded-3xl border border-dream-line bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-dream-sun text-dream-ink">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m12 2 9 5-9 5-9-5 9-5Z" />
            <path d="m3 12 9 5 9-5" />
            <path d="m3 17 9 5 9-5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-dream-ink">
            You placed {total} requests
          </p>
          <p className="text-xs leading-relaxed text-dream-muted">
            Every design is quoted, proofed and invoiced on its own, so each one has its own
            page.{current ? ` You're on ${current}.` : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {siblings.map((s) => (
          <Link
            key={s.token}
            href={href(s.token)}
            className="group flex items-center gap-3 rounded-2xl border border-dream-line bg-dream-bg p-2.5 transition hover:border-dream-purple/40 hover:bg-dream-lavender/25"
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-dream-line bg-white">
              {s.mockup ? (
                <Image
                  src={s.mockup}
                  alt=""
                  width={112}
                  height={112}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="text-dream-muted"
                  aria-hidden
                >
                  <path d="M8 3 4 5v6h3v10h10V11h3V5l-4-2a4 4 0 0 1-8 0Z" />
                </svg>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-display text-sm font-bold text-dream-ink">
                  {s.title}
                </span>
                <Badge variant={STATUS_META[s.status]?.badge ?? "neutral"} className="shrink-0">
                  {orderStatusLabel(s.status)}
                </Badge>
              </span>
              <span className="mt-0.5 block truncate text-xs text-dream-muted">
                {s.number}
                {s.pieces > 0 ? ` · ${s.pieces} ${s.pieces === 1 ? "piece" : "pieces"}` : ""}
                {s.colours.length ? ` · ${s.colours.join(", ")}` : ""}
              </span>
              {s.total !== null && (
                <span className="mt-0.5 block text-xs font-semibold text-dream-ink">
                  {formatCAD(s.total)}
                </span>
              )}
            </span>

            <span className="shrink-0 pr-1 text-dream-purple transition group-hover:translate-x-0.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
