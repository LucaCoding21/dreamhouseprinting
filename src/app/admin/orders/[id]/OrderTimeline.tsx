"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { addOrderNoteAction } from "../actions";
import { fmtWhen, useOrderAction, type Note } from "./shared";
import type { OrderRow } from "@/lib/db/rows";

/**
 * Two separate boxes rather than one feed with a visibility dropdown.
 *
 * The dropdown put "notes to myself" and "email the customer" one mis-click
 * apart, on a control you had to read to know which one you were about to do.
 * They are different jobs, so they get different boxes: internal comments up
 * top (the everyday one), the customer conversation below it.
 *
 * They also read from different columns, which already existed:
 * `internal_notes` never leaves the admin, while EVERY entry in
 * `customer_notes` is rendered on the customer's order page. Note that
 * customer_notes is a two-way channel, not an outbox: order placement stamps
 * the customer's own rush request into it with actor "customer", so the lower
 * box shows direction per entry instead of pretending it is all outbound.
 */
export function OrderTimeline({
  order,
  orderId,
  canEdit,
  recipient,
}: {
  order: OrderRow;
  orderId: string;
  canEdit: boolean;
  /** Who a customer message actually reaches, named on the send button. */
  recipient: string | null;
}) {
  const internal = useMemo(
    () => sortNewestFirst((order.internal_notes ?? []) as unknown as Note[]),
    [order.internal_notes],
  );
  const conversation = useMemo(
    () => sortNewestFirst((order.customer_notes ?? []) as unknown as Note[]),
    [order.customer_notes],
  );

  return (
    <div className="space-y-6">
      {/* Main box: the everyday one. Nothing here can reach the customer. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Order comments</CardTitle>
          <p className="mt-0.5 text-xs text-dream-muted">
            Internal only. The customer never sees these.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {internal.length === 0 && (
            <p className="text-sm text-dream-muted">
              No comments yet. Notes to yourself and your team show up here, newest first.
            </p>
          )}

          {internal.map((n, i) => (
            <div
              key={`${n.at}-${i}`}
              className="rounded-lg border border-dream-warn/30 bg-dream-warn-soft px-4 py-3"
            >
              <NoteHeader note={n} />
              <p className="mt-1 whitespace-pre-wrap text-sm text-dream-ink">{n.text}</p>
            </div>
          ))}

          <Composer
            orderId={orderId}
            visibility="internal"
            canEdit={canEdit}
            placeholder="Add an internal comment…"
            submitLabel="Add comment"
            toast="Comment added"
          />
        </CardContent>
      </Card>

      {/* Second box: the outward-facing one, deliberately below the main box so
          it is never the field you land in by habit. */}
      <Card className="border-dream-info/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MailIcon />
            Customer messages
          </CardTitle>
          <p className="mt-0.5 text-xs text-dream-muted">
            {recipient ? (
              <>
                Sending emails <span className="font-semibold text-dream-ink">{recipient}</span> and
                posts to their order page.
              </>
            ) : (
              <>Posts to the customer&apos;s order page.</>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {conversation.length === 0 && (
            <p className="text-sm text-dream-muted">
              Nothing sent yet. Messages between you and the customer show up here, newest first.
            </p>
          )}

          {conversation.map((n, i) => {
            // Placement stamps the customer's own asks with actor "customer".
            // Those are inbound records, not something we emailed them.
            const inbound = (n.actor ?? "").toLowerCase() === "customer";
            return (
              <div
                key={`${n.at}-${i}`}
                className={cn(
                  "rounded-lg border px-4 py-3",
                  inbound ? "border-dream-line bg-dream-bg" : "border-dream-info/30 bg-dream-info-soft",
                )}
              >
                <NoteHeader
                  note={n}
                  badge={inbound ? "From the customer" : "Sent to customer"}
                  badgeClass={
                    inbound
                      ? "bg-dream-line text-dream-muted"
                      : "bg-dream-info/15 text-dream-info"
                  }
                />
                <p className="mt-1 whitespace-pre-wrap text-sm text-dream-ink">{n.text}</p>
              </div>
            );
          })}

          <Composer
            orderId={orderId}
            visibility="customer"
            canEdit={canEdit}
            placeholder="Write a message to the customer…"
            // Naming the actual inbox on the button is the safeguard the dropdown
            // never gave: you cannot click send without seeing who receives it.
            submitLabel={recipient ? `Email ${recipient}` : "Send to customer"}
            toast="Message sent to the customer"
            tone="info"
          />
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- helpers ------------------------------- */

function sortNewestFirst(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function NoteHeader({
  note,
  badge,
  badgeClass,
}: {
  note: Note;
  badge?: string;
  badgeClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-bold text-dream-ink">
        {note.actor}
        <span className="ml-1 font-normal text-dream-muted">@ {fmtWhen(note.at)}</span>
      </span>
      {badge && (
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            badgeClass,
          )}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/** Textarea + send button for one fixed destination. No visibility picker:
 *  which box you are typing in IS the choice. */
function Composer({
  orderId,
  visibility,
  canEdit,
  placeholder,
  submitLabel,
  toast,
  tone = "primary",
}: {
  orderId: string;
  visibility: "internal" | "customer";
  canEdit: boolean;
  placeholder: string;
  submitLabel: string;
  toast: string;
  tone?: "primary" | "info";
}) {
  const { pending, run } = useOrderAction();
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-wrap items-start gap-2 border-t border-dream-line pt-3">
      <Textarea
        rows={1}
        placeholder={placeholder}
        value={note}
        disabled={!canEdit}
        onChange={(e) => setNote(e.target.value)}
        className="min-h-10 flex-1 basis-64"
      />
      <Button
        variant={tone === "info" ? "secondary" : "primary"}
        loading={pending}
        disabled={!canEdit || !note.trim()}
        className={cn(
          "max-w-full truncate",
          tone === "info" && "border-dream-info/40 text-dream-info hover:bg-dream-info-soft",
        )}
        onClick={() =>
          run(async () => {
            const r = await addOrderNoteAction(orderId, note, visibility);
            if (!r.error) setNote("");
            return r;
          }, toast)
        }
      >
        {submitLabel}
      </Button>
    </div>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-dream-info"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
