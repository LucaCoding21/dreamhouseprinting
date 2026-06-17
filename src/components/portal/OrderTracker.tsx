import { TRACKER_STAGES, statusStageIndex } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/rows";
import { cn } from "@/lib/cn";

/**
 * The Domino's-style order tracker (PRD §5.4.1) — a dog carrying a bag advances
 * through the production stages. A friendly visual layer over the order status
 * field (single source of truth). Cancelled/on-hold render a neutral note.
 */
export function OrderTracker({ status }: { status: OrderStatus }) {
  const stage = statusStageIndex(status);

  if (status === "cancelled") {
    return (
      <div className="rounded-xl border border-dream-line bg-dream-danger-soft px-4 py-3 text-sm text-dream-danger">
        This order was cancelled.
      </div>
    );
  }

  const pct = stage <= 0 ? 0 : (stage / (TRACKER_STAGES.length - 1)) * 100;

  return (
    <div className="rounded-xl border border-dream-line bg-dream-surface p-5">
      <div className="relative mx-2 mt-6">
        {/* Track */}
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-dream-line" />
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-dream-purple transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        {/* The dog, riding the progress */}
        <div
          className="absolute -top-7 -translate-x-1/2 text-2xl transition-all duration-700"
          style={{ left: `${pct}%` }}
          aria-hidden
        >
          🐕
        </div>
        {/* Stage dots */}
        <div className="relative flex justify-between">
          {TRACKER_STAGES.map((s, i) => {
            const done = i <= stage;
            return (
              <div key={s.key} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "h-4 w-4 rounded-full border-2",
                    done ? "border-dream-purple bg-dream-purple" : "border-dream-line bg-dream-surface"
                  )}
                />
              </div>
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
              i <= stage ? "font-medium text-dream-ink" : "text-dream-faint"
            )}
          >
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
