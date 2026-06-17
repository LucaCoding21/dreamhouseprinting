import Image from "next/image";
import { TRACKER_STAGES, statusStageIndex } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/rows";
import { cn } from "@/lib/cn";

/**
 * The Domino's-style order tracker (PRD §5.4.1) — our doodle dog trots along the
 * track carrying the order bag, hopping as it goes and advancing between stages.
 * A friendly visual layer over the order status field (single source of truth).
 * Cancelled / on-hold render a neutral note instead of the journey.
 */
export function OrderTracker({ status }: { status: OrderStatus }) {
  const stage = statusStageIndex(status);

  if (status === "cancelled") {
    return (
      <div className="rounded-2xl border border-dream-danger/20 bg-dream-danger-soft px-4 py-3 text-sm font-medium text-dream-danger">
        This order was cancelled. Reach out and we&apos;ll help sort it.
      </div>
    );
  }
  if (status === "on_hold") {
    return (
      <div className="rounded-2xl border border-dream-warn/20 bg-dream-warn-soft px-4 py-3 text-sm font-medium text-dream-warn">
        This order is on hold — we&apos;ll be in touch shortly.
      </div>
    );
  }

  const last = TRACKER_STAGES.length - 1;
  const pct = stage <= 0 ? 0 : (stage / last) * 100;
  const complete = stage >= last;

  return (
    <div className="rounded-2xl border border-dream-line bg-white p-5 pt-4 shadow-sm">
      <div className="relative mx-3 mt-12">
        {/* Track */}
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-dream-lavender-soft" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-dream-purple transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />

        {/* The dog, carrying the bag, riding the progress */}
        <div
          className="absolute bottom-3 z-10 -translate-x-1/2 transition-all duration-700 ease-out"
          style={{ left: `${pct}%` }}
          aria-hidden
        >
          <Image
            src="/how it works/3dog.png"
            alt=""
            width={72}
            height={70}
            className={cn("h-14 w-auto drop-shadow-sm", complete ? "animate-dog-cheer" : "animate-dog-trot")}
            priority
          />
        </div>

        {/* Stage dots */}
        <div className="relative flex justify-between">
          {TRACKER_STAGES.map((s, i) => {
            const done = i <= stage;
            return (
              <div
                key={s.key}
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition-colors",
                  done ? "border-dream-purple bg-dream-purple" : "border-dream-line bg-white"
                )}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex justify-between">
        {TRACKER_STAGES.map((s, i) => (
          <div
            key={s.key}
            className={cn(
              "w-16 text-center text-[11px] leading-tight",
              i <= stage ? "font-semibold text-dream-ink" : "text-dream-faint"
            )}
          >
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
