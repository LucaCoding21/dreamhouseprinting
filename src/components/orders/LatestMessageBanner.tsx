import type { OrderViewMessage } from "./types";

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ChatIcon() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-dream-purple text-white">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
      </svg>
    </span>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-dream-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Messages Julian sent the customer, pinned near the top of the order page so
 * a note can't get buried in the "Order history" timeline. The whole card is a
 * dropdown (a plain <details>, no JS): the header row is always visible and
 * toggles the messages under it. Open by default so the newest message is
 * read; earlier messages follow it, oldest last.
 */
export function LatestMessageBanner({ messages }: { messages: OrderViewMessage[] }) {
  const [latest, ...earlier] = messages;
  if (!latest) return null;
  const from = latest.actor?.trim() || "Dreamhouse Printing";

  return (
    <details open className="group rounded-2xl border border-dream-line bg-white shadow-sm sm:rounded-3xl">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 sm:p-5 [&::-webkit-details-marker]:hidden">
        <ChatIcon />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold leading-tight text-dream-ink">
            {messages.length > 1 ? `Messages from ${from}` : `Message from ${from}`}
          </p>
          <p className="mt-0.5 text-[13px] text-dream-muted">
            {fmtWhen(latest.at)}
            {messages.length > 1 && ` · ${messages.length} messages`}
          </p>
        </div>
        <Chevron />
      </summary>

      <div className="border-t border-dream-line">
        <p className="whitespace-pre-wrap break-words px-3.5 py-3.5 text-sm leading-relaxed text-dream-ink sm:px-5 sm:py-4">
          {latest.text}
        </p>
        {earlier.length > 0 && (
          <ol className="divide-y divide-dream-line border-t border-dream-line">
            {earlier.map((m, i) => (
              <li key={`${m.at}-${i}`} className="bg-dream-cream/30 px-3.5 py-3.5 sm:px-5 sm:py-4">
                <p className="text-[13px] font-semibold text-dream-muted">
                  {m.actor?.trim() || "Dreamhouse Printing"} · {fmtWhen(m.at)}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-dream-ink">{m.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
