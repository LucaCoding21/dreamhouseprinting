import Image from "next/image";
import { TRACKER_STAGES, statusStageIndex } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/rows";
import { cn } from "@/lib/cn";

/**
 * Per-stage self-animating dog (animated .webp). Keyed by tracker stage index
 * (see TRACKER_STAGES). Stages without an entry fall back to the CSS-animated
 * doodle. Optimized: one small animated file per stage instead of a frame seq.
 */
const STAGE_DOGS: Record<number, string> = {
  0: "/order-received-dog.webp", // Order received
  1: "/how-it-works/step-2-proof-review.webp", // Proof ready
  2: "/how-it-works/step-3-printing.webp", // In production
  3: "/delivery-status-dog.webp", // Shipped / ready
  4: "/delivered-status-dog.webp", // Complete
};

/**
 * Per-stage oval tuning (size + vertical position). Each dog illustration sits
 * differently on the canvas, so the oval behind it is tuned per stage. A flat,
 * low oval reads as a ground shadow; a taller, higher one reads as a backdrop.
 * Stages without an entry fall back to DEFAULT_OVAL.
 */
const STAGE_OVAL: Record<number, string> = {
  0: "left-[55%] top-[84%] h-9 w-48 rounded-[100%] sm:h-11 sm:w-56", // Order received, flat shadow under the dog
  1: "left-[52%] top-[45%] h-56 w-56 rotate-6 rounded-[46%_54%_52%_48%/56%_52%_48%_44%] sm:h-72 sm:w-72", // Proof ready, organic blob
  3: "left-1/2 top-[80%] h-8 w-48 rounded-[100%] sm:h-10 sm:w-56", // Shipped / ready, flat shadow under the dog
  4: "left-1/2 top-[80%] h-[37px] w-40 rounded-[100%] sm:h-[45px] sm:w-48", // Complete, slightly taller + narrower shadow
};
const DEFAULT_OVAL = "left-1/2 top-[62%] h-24 w-56 rounded-[100%] sm:h-28 sm:w-64";

/**
 * Per-stage dog sizing. Height sets the LAYOUT box (how much room it reserves);
 * a `scale-*` transform enlarges it VISUALLY without growing that box, so a dog
 * can look bigger without pushing the text / widening the container.
 */
const STAGE_DOG_SIZE: Record<number, string> = {
  3: "h-44 -translate-y-4 scale-[1.4] sm:h-52 sm:scale-[1.4]", // Shipped / ready, big visually, small footprint
  4: "h-52 scale-110 sm:h-64 sm:scale-110", // Complete, same footprint, a touch bigger visually
};
const DEFAULT_DOG_SIZE = "h-52 sm:h-64";

/** Friendly one-liner shown under the stage name, keyed by tracker stage key. */
const STAGE_COPY: Record<string, string> = {
  received: "We've got your order and we're on it.",
  proof: "Your proof is ready for review.",
  production: "We're printing your order right now!",
  fulfilment: "Your order is on its way to you!",
  complete: "Delivered. Enjoy your new gear!",
};

function fmtStageDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function fmtReadyDate(date: string): string {
  // date is a plain YYYY-MM-DD, pin to local midnight so it never shifts a day.
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Order progress tracker (PRD §5.4.1), a playful hero of the current stage:
 * the "current status" name on the left, the stage's doodle dog on an organic
 * blob on the right, a labeled + dated milestone rail beneath, and an
 * estimated-ready card. A friendly layer over the order status field (single
 * source of truth). Cancelled / on-hold render a neutral note instead.
 */
export function OrderTracker({
  status,
  stageDates,
  dueDate,
}: {
  status: OrderStatus;
  /** ISO date the order entered each tracker stage; null where unknown. */
  stageDates?: (string | null)[];
  /** Estimated ready date (YYYY-MM-DD). */
  dueDate?: string | null;
}) {
  if (status === "cancelled") {
    return (
      <div className="rounded-3xl border-2 border-dream-danger/20 bg-dream-danger-soft px-5 py-4 text-sm font-medium text-dream-danger">
        This order was cancelled. Reach out and we&apos;ll help sort it.
      </div>
    );
  }
  if (status === "on_hold") {
    return (
      <div className="rounded-3xl border-2 border-dream-warn/20 bg-dream-warn-soft px-5 py-4 text-sm font-medium text-dream-warn">
        This order is on hold. We&apos;ll be in touch shortly.
      </div>
    );
  }

  const last = TRACKER_STAGES.length - 1;
  const clamped = Math.max(0, Math.min(statusStageIndex(status), last));
  const current = TRACKER_STAGES[clamped];
  const dog = STAGE_DOGS[clamped];

  return (
    <div className="rounded-3xl border-2 border-dream-ink/10 bg-white shadow-[5px_5px_0_0_rgba(118,100,255,0.10)]">
      <div className="p-6 sm:p-8">
        {/* Title with a sketchy underline + a little twinkle */}
        <div className="relative inline-block">
          <h2 className="font-display text-2xl font-extrabold text-dream-ink sm:text-[26px]">Order status</h2>
          <svg viewBox="0 0 220 10" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-2 w-[85%] text-dream-purple/60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
            <path d="M2 6C40 2 120 2 218 5" />
          </svg>
        </div>

        {/* Current stage on the left, doodle dog on an organic blob on the right */}
        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-center lg:gap-20">
          <div className="min-w-0">
            <div className="whitespace-nowrap font-display text-3xl font-extrabold leading-tight text-dream-ink sm:text-[34px]">
              {current.label}
            </div>
            <p className="mt-1.5 whitespace-nowrap text-sm leading-relaxed text-dream-muted">
              {STAGE_COPY[current.key] ?? "We'll keep you posted every step of the way."}
            </p>
          </div>

          <div className="relative flex shrink-0 items-center justify-center self-center">
            <span
              aria-hidden
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 bg-dream-lavender/45",
                STAGE_OVAL[clamped] ?? DEFAULT_OVAL,
              )}
            />
            {dog ? (
              // Animated webp already loops on its own, no CSS keyframe needed.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dog} alt="" className={cn("relative w-auto object-contain", STAGE_DOG_SIZE[clamped] ?? DEFAULT_DOG_SIZE)} />
            ) : (
              <Image
                src="/how-it-works/3dog.png"
                alt=""
                width={72}
                height={70}
                className="relative h-24 w-auto animate-dog-trot"
                priority
              />
            )}
          </div>
        </div>

        {/* Milestone rail, finished stages check off, the live stage is a purple
            target that twinkles, upcoming stages are hollow with a dotted track. */}
        <ol className="mt-8 flex w-full items-start">
          {TRACKER_STAGES.map((s, i) => {
            const done = i < clamped;
            const isCurrent = i === clamped;
            const reached = i <= clamped;
            const finish = isCurrent && clamped >= last;
            const showCheck = done || finish;
            const when = reached ? stageDates?.[i] : null;
            return (
              <li key={s.key} className="relative flex flex-1 flex-col items-center">
                {i > 0 &&
                  (reached ? (
                    <span aria-hidden className="absolute right-1/2 top-4 h-[3px] w-full rounded-full bg-dream-purple" />
                  ) : (
                    <span aria-hidden className="absolute right-1/2 top-4 w-full border-t-2 border-dashed border-dream-purple/30" />
                  ))}

                <span
                  className={cn(
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors duration-500",
                    showCheck
                      ? "border-dream-purple bg-dream-purple text-white"
                      : isCurrent
                        ? "border-dream-purple bg-dream-purple ring-4 ring-dream-purple/20"
                        : "border-dream-purple/25 bg-white",
                  )}
                >
                  {showCheck ? (
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 10.5l3.5 3.5L15 6.5" />
                    </svg>
                  ) : isCurrent ? (
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-dream-purple" />
                    </span>
                  ) : null}
                </span>

                <span
                  className={cn(
                    "mt-2 px-0.5 text-center text-[11px] leading-tight transition-colors duration-500",
                    isCurrent ? "font-semibold text-dream-ink" : reached ? "text-dream-ink-soft" : "text-dream-faint",
                  )}
                >
                  {s.label}
                </span>
                {when && <span className="mt-0.5 text-[10px] text-dream-faint">{fmtStageDate(when)}</span>}
              </li>
            );
          })}
        </ol>

        {dueDate && (
          <div className="mt-7 flex items-center gap-4 rounded-2xl border border-dream-line bg-dream-lavender-soft/25 px-5 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-dream-lavender-soft text-dream-purple">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 9h18M8 3v4M16 3v4" />
                <path d="M12 17c-1.4-1-2.6-1.9-2.6-3a1.2 1.2 0 0 1 2.2-.7l.4.5.4-.5a1.2 1.2 0 0 1 2.2.7c0 1.1-1.2 2-2.6 3z" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span aria-hidden className="h-8 w-px bg-dream-line" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-dream-muted">Estimated ready by</div>
              <div className="font-display text-base font-bold text-dream-purple">{fmtReadyDate(dueDate)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
