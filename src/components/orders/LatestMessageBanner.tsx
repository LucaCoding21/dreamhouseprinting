import { IconBell } from "@/components/portal/icons";
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
    <div className="rounded-2xl border-2 border-dream-purple bg-dream-lavender/40 p-4 shadow-[0_4px_0_0_rgba(118,100,255,0.25)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-dream-purple text-white">
          <IconBell className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="font-display text-sm font-bold text-dream-purple">
              Message from {message.actor?.trim() || "Dreamhouse Printing"}
            </p>
            <p className="text-xs text-dream-muted">{when}</p>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-dream-ink">
            {message.text}
          </p>
        </div>
      </div>
    </div>
  );
}
