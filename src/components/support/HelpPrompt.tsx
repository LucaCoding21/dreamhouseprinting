import Link from "next/link";
import { cn } from "@/lib/cn";
import { CONTACT_PATH, SUPPORT_RESPONSE } from "@/lib/support";

/**
 * A friendly "we're here to help" nudge that points at the public contact form.
 * Used across the buying flow (product, designer, cart, confirmation) so an
 * unsure customer always has a person to reach. No login required.
 *
 * `card` is the fuller version for calmer spots (product page, order confirmed);
 * `inline` is a slim one-liner for dense screens (cart, designer review).
 */
export function HelpPrompt({
  variant = "card",
  title = "Questions before you order?",
  body,
  className,
  newTab = false,
}: {
  variant?: "card" | "inline";
  title?: string;
  body?: string;
  className?: string;
  /** Open the contact page in a new tab. Use inside the designer so an
   *  in-progress design is never lost when someone reaches out for help. */
  newTab?: boolean;
}) {
  // In a new tab, keep the opener alive and safe (noopener) so the designer,
  // and the customer's unsaved work, stays exactly where they left it.
  const tabProps = newTab
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-dream-muted",
          className,
        )}
      >
        <ChatIcon className="h-4 w-4 shrink-0 text-dream-purple" />
        <span>{title}</span>
        <Link
          href={CONTACT_PATH}
          {...tabProps}
          className="inline-flex items-center gap-1 font-semibold text-dream-purple underline-offset-2 hover:underline"
        >
          Contact us
          <ArrowIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 rounded-2xl border border-dream-line bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-dream-lavender-soft text-dream-purple">
          <ChatIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-dream-ink">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-dream-muted">
            {body ?? `A real person is here to help. ${SUPPORT_RESPONSE}`}
          </p>
        </div>
      </div>
      <Link
        href={CONTACT_PATH}
        {...tabProps}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-dream-purple px-5 py-2.5 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
      >
        Contact us
        <ArrowIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ChatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 5.5c5.3-.6 10.7-.6 16 0 .5 3.2.5 6.4 0 9.6-2 .3-4 .4-6 .5l-4 3.4v-3.4c-2 0-4-.2-6-.5-.5-3.2-.5-6.4 0-9.6Z" />
      <path d="M8.5 10h7M8.5 12.6h4.5" />
    </svg>
  );
}

function ArrowIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
