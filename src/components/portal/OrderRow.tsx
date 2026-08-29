import Link from "next/link";
import { STATUS_META } from "@/lib/orderStatus";
import { formatCAD } from "@/lib/money";
import { cn } from "@/lib/cn";
import { StatusTag } from "@/components/portal/StatusTag";
import {
  IconClock,
  IconPencil,
  IconPrinter,
  IconTruck,
  IconCheck,
  IconChevronRight,
} from "@/components/portal/icons";
import type { OrderRow, OrderStatus } from "@/lib/db/rows";

// Pill-free status: a coloured dot + coloured label. Used in the table layout.
const STATUS_TEXT: Record<string, string> = {
  neutral: "text-dream-muted",
  info: "text-dream-info",
  purple: "text-dream-purple",
  success: "text-dream-success",
  warn: "text-dream-warn",
  danger: "text-dream-danger",
};
function StatusLabel({ tone, label }: { tone: string; label: string }) {
  return (
    <span className={`text-sm font-semibold ${STATUS_TEXT[tone] ?? "text-dream-muted"}`}>{label}</span>
  );
}

// Payment status is a separate axis from the order status; unpaid stays muted
// (not alarming) since most in-progress orders are unpaid until invoiced.
const PAYMENT_META: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "Unpaid", tone: "neutral" },
  deposit_paid: { label: "Deposit paid", tone: "info" },
  paid_in_full: { label: "Paid", tone: "success" },
  refunded: { label: "Refunded", tone: "neutral" },
  partially_refunded: { label: "Part. refunded", tone: "neutral" },
};

function orderTotal(o: OrderRow): number {
  return ((o.pricing ?? {}) as { total?: number }).total ?? 0;
}

/** Short human note about where the order is right now. */
export function statusNote(o: OrderRow): string {
  const tracking = (o.shipping_tracking ?? "").trim();
  switch (o.status) {
    case "submitted":
    case "in_review":
      return "We’re reviewing your artwork and prepping a proof.";
    case "proof_ready":
      return "Your proof is ready. Approve it before we print.";
    case "changes_requested":
      return "Change request sent. We’re on it.";
    case "approved":
      return o.payment_status === "unpaid"
        ? "Approved. We’ll send your invoice to arrange payment."
        : "Approved and queued for printing.";
    case "in_production":
      return "We’re printing your order.";
    case "quality_check":
      return "Final quality check before it ships.";
    case "shipped":
      return tracking ? `On its way. Tracking ${tracking}` : "Shipped and on its way.";
    case "ready_for_pickup":
      return "Ready for pickup.";
    case "on_hold":
      return "On hold. We’ll be in touch.";
    case "completed":
      return "Delivered. Thanks for printing with us!";
    default:
      return "";
  }
}

/** Icon shape per state, a uniform, quiet lavender tint so the status tag is
 *  the only colour signal (less visual noise, one thing to read per row). */
function statusIcon(status: OrderStatus): typeof IconClock {
  switch (status) {
    case "changes_requested":
      return IconPencil;
    case "approved":
    case "completed":
      return IconCheck;
    case "in_production":
      return IconPrinter;
    case "shipped":
    case "ready_for_pickup":
      return IconTruck;
    default:
      return IconClock;
  }
}

/** Column header for the aligned My Orders list. Widths mirror OrderListRow
 *  exactly (same gap-4 + column widths) so cells line up like a table. Hidden on
 *  mobile, where rows stack. */
export function OrderListHeader() {
  return (
    <div className="hidden items-center gap-4 pr-4 pb-1 text-[14px] font-semibold uppercase tracking-wide text-dream-faint xl:flex">
      <span className="min-w-0 flex-1">Order</span>
      <div className="flex items-center gap-8">
        <span className="w-32 shrink-0">Date</span>
        <span className="w-36 shrink-0">Status</span>
        <span className="w-28 shrink-0">Payment</span>
        <span className="w-24 shrink-0">Total</span>
      </div>
      <span className="w-5 shrink-0" aria-hidden />
    </div>
  );
}

/** The shared "order line" used on the dashboard and the My Orders list.
 *
 *  Default ("card"): status tag inline next to the order number, price + date
 *  stacked on the right, the friendly dashboard look.
 *
 *  `columns` ("table"): on desktop it lays out as aligned columns
 *  (Order / Status / Total / Date) so a list reads like a tidy table under
 *  OrderListHeader; on mobile it falls back to the same stacked card. */
export function OrderListRow({ o, columns = false }: { o: OrderRow; columns?: boolean }) {
  const Icon = statusIcon(o.status as OrderStatus);
  const meta = STATUS_META[o.status as OrderStatus];
  const payment = PAYMENT_META[o.payment_status ?? "unpaid"];
  const paid = o.payment_status === "paid_in_full";
  const dateLabel = new Date(o.created_at).toLocaleDateString("en-CA");
  const total = formatCAD(orderTotal(o));
  return (
    <Link
      href={`/account/orders/${o.id}`}
      className="group block rounded-2xl border border-dream-line bg-white px-[18px] py-4 transition-colors hover:border-dream-line-strong sm:flex sm:items-center sm:gap-4 sm:px-4 sm:py-5"
    >
      {/* ---- Phone card (below sm). Three tiers: what it is + where it is
          (number + status tag), what that means (note), then the money line
          with the date and the chevron on a divider. ---- */}
      <div className="sm:hidden">
        {/* items-baseline so the order number and its status tag sit on one
            line, rather than the tag riding above the number's baseline. */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-base font-bold leading-tight text-dream-ink">
            Order {o.order_number ?? ""}
          </span>
          {/* Coloured text, no chip: the tinted box was a second rectangle
              inside the card competing with the card's own edge. */}
          {meta && (
            <span className="shrink-0">
              <StatusLabel tone={meta.badge} label={meta.label} />
            </span>
          )}
        </div>
        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-dream-muted">{statusNote(o)}</p>
        {/* No chevron here: it sat after the total and pushed it in from the
            right edge, so the total no longer lined up under the status above.
            The whole card is the link, and the sm+ layout keeps its chevron. */}
        <div className="-mb-1 mt-3 flex items-baseline justify-between gap-3 border-t border-dream-line pt-2">
          <span className="text-[13px] text-dream-faint">{dateLabel}</span>
          <span className="flex items-baseline gap-2">
            <span className={cn("text-[13px] font-semibold", paid ? "text-dream-success" : "text-dream-faint")}>
              {payment?.label ?? ""}
            </span>
            <span className="font-display text-base font-bold text-dream-ink">{total}</span>
          </span>
        </div>
      </div>

      {/* ---- sm+ row. Icon + order + note, grouped as one flex-1 cell so the
          "Order" header lines up flush-left above the icon while the columns
          still align. ---- */}
      <div className="hidden min-w-0 flex-1 items-center gap-4 sm:flex">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-dream-lavender-soft text-dream-purple">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-[15px] font-semibold text-dream-ink">{o.order_number ?? "Order"}</span>
            {meta &&
              (columns ? (
                <span className="xl:hidden">
                  <StatusLabel tone={meta.badge} label={meta.label} />
                </span>
              ) : (
                <StatusTag tone={meta.badge}>{meta.label}</StatusTag>
              ))}
          </div>
          <p className="mt-0.5 truncate text-[14px] text-dream-muted">{statusNote(o)}</p>
        </div>
      </div>

      {columns ? (
        <>
        <div className="hidden shrink-0 text-right sm:block xl:hidden">
          <div className="font-display font-bold text-dream-ink">{total}</div>
          <div className="text-[14px] text-dream-faint">
            {paid ? "Paid · " : ""}
            {dateLabel}
          </div>
        </div>
        <div className="hidden items-center gap-8 xl:flex">
          <div className="w-32 shrink-0 text-[14px] text-dream-faint">{dateLabel}</div>
          <div className="w-36 shrink-0">
            {meta && <StatusLabel tone={meta.badge} label={meta.label} />}
          </div>
          <div className="w-28 shrink-0 text-[14px] text-dream-muted">
            {payment?.label ?? ""}
          </div>
          <div className="w-24 shrink-0 font-display text-sm font-semibold text-dream-ink">{total}</div>
        </div>
        </>
      ) : (
        <div className="hidden shrink-0 text-right sm:block">
          <div className="font-display font-bold text-dream-ink">{total}</div>
          <div className="text-[14px] text-dream-faint">
            {paid ? "Paid · " : ""}
            {dateLabel}
          </div>
        </div>
      )}

      <IconChevronRight className="hidden h-5 w-5 shrink-0 text-dream-faint transition-transform group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}
