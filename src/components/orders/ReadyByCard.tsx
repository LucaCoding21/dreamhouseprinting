import { cn } from "@/lib/cn";
import { fmtDaysRange, fmtReadyDay, type ReadyBy } from "@/lib/orders/turnaround";

/**
 * "When will it be ready?" at the top of the customer's order status card.
 * Julian's wording: before the count starts the customer reads the rule ("ready
 * 8-12 business days after approval and payment"), plus what acting today would
 * mean in real dates; once approved and paid they read the dates themselves.
 */
export function readyByCopy(ready: ReadyBy): { label: string; headline: string; detail: string | null } {
  if (ready.state === "date") {
    return ready.requested
      ? { label: "Requested date", headline: fmtReadyDay(ready.date), detail: "We'll confirm this date with your proof." }
      : { label: "Ready by", headline: fmtReadyDay(ready.date), detail: null };
  }

  const range = fmtDaysRange(ready);

  // Counting: just the dates, in plain words. No "8-12 business days, counted
  // from..." line under them; customers read that as a second, different date.
  if (ready.state === "running") {
    if (!ready.from || !ready.to) return { label: "Ready date", headline: `${range} from approval and payment`, detail: null };
    const day = (iso: string) => fmtReadyDay(iso, { weekday: false });
    return {
      label: "Ready date",
      headline: ready.min === ready.max ? `By ${day(ready.to)}` : `Between ${day(ready.from)} and ${day(ready.to)}`,
      detail: null,
    };
  }

  // Waiting: the count starts once the customer has approved and paid. Say
  // only what is still owed ("after you pay" once they've approved). No
  // projected dates here: the rule alone reads cleaner, the dates come once
  // the count starts.
  const owed = ready.ask === "pay" ? "pay" : ready.ask === "approve" ? "approve" : "approve and pay";
  return { label: "Ready date", headline: `${range} after you ${owed}`, detail: null };
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
      <path d="M12 17c-1.4-1-2.6-1.9-2.6-3a1.2 1.2 0 0 1 2.2-.7l.4.5.4-.5a1.2 1.2 0 0 1 2.2.7c0 1.1-1.2 2-2.6 3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ReadyByCard({ ready, compact = false, className }: { ready: ReadyBy; compact?: boolean; className?: string }) {
  const { label, headline, detail } = readyByCopy(ready);
  // A date is short and can be big; the waiting sentence is long and reads as body copy.
  const long = ready.state === "waiting" || (ready.state === "running" && !ready.from);

  if (compact) {
    return (
      <div className={cn("flex items-start gap-3 rounded-xl bg-white px-3.5 py-3", className)}>
        <CalendarIcon className="mt-0.5 h-5 w-5 shrink-0 text-dream-purple" />
        <div className="min-w-0">
          <p className="text-xs text-dream-muted">{label}</p>
          <p className={cn("font-display font-bold leading-snug text-dream-ink", long ? "text-[15px]" : "text-base text-dream-purple")}>
            {headline}
          </p>
          {detail && <p className="mt-0.5 text-[13px] leading-snug text-dream-muted">{detail}</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-dream-line bg-dream-lavender-soft/25 px-4 py-3.5 sm:gap-4 sm:px-5",
        className,
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-dream-lavender-soft text-dream-purple">
        <CalendarIcon className="h-5 w-5" />
      </span>
      <span aria-hidden className="h-8 w-px shrink-0 bg-dream-line" />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-dream-muted">{label}</div>
        <div className={cn("font-display font-bold leading-snug", long ? "text-[15px] text-dream-ink" : "text-base text-dream-purple")}>
          {headline}
        </div>
        {detail && <div className="mt-0.5 text-sm leading-snug text-dream-muted">{detail}</div>}
      </div>
    </div>
  );
}
