import type { OrderViewMessage } from "./types";

/**
 * The newest message Julian sent the customer, pinned to the very top of the
 * order page (above the order number) so a note can't get buried in the
 * "Order history" timeline where customers rarely look.
 */
export function LatestMessageBanner({ message }: { message: OrderViewMessage }) {
  const when = new Date(message.at).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="rounded-3xl border border-dream-line bg-white p-4 shadow-sm sm:p-5">
      {/* Header: who + when */}
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-dream-purple text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 truncate font-display text-sm font-bold text-dream-ink">
          Message from {message.actor?.trim() || "Dreamhouse Printing"}
        </p>
        <p className="shrink-0 text-xs font-medium text-dream-muted">{when}</p>
      </div>

      {/* The message itself, set apart in a soft bubble */}
      <div className="mt-3 rounded-xl bg-dream-lavender/35 px-4 py-3">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-dream-ink">
          {message.text}
        </p>
      </div>
    </div>
  );
}
