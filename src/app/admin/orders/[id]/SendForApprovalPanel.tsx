"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import { scrollToCenter } from "@/lib/scrollToCenter";
import type { OrderStatus } from "@/lib/db/rows";
import { sendForApprovalAction } from "../actions";
import { useOrderAction, type Detail } from "./shared";

/** Statuses an order can be (re)sent for approval from. */
const SENDABLE = new Set<string>(["draft", "submitted", "in_review", "proof_ready", "changes_requested"]);

/**
 * Activity that means the ORDER changed, so a proof already with the customer is
 * now out of date. "order_edited" is the generic marker; the rest are the
 * specific edit logs the order actions write today.
 */
const EDIT_ACTIVITY = new Set<string>([
  "order_edited",
  "proof_uploaded",
  "items_updated",
  "item_removed",
  "product_changed",
  "price_edit",
]);

/** "Dad Hat, Tote bag and 2 more", so a long list can't swallow the caption. */
function nameList(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

export const SEND_PANEL_ID = "send-for-approval";

/** Scroll the send panel into view and put the cursor in its message box. */
export function goToSendPanel() {
  const panel = document.getElementById(SEND_PANEL_ID);
  scrollToCenter(panel);
  panel?.querySelector("textarea")?.focus({ preventScroll: true });
}

/**
 * Proof coverage and send state, shared by the command header (captions,
 * banners) and the send panel under the items.
 *
 * Proofs filed on the order are drafts until "Send for approval" puts the whole
 * set in front of the customer, and the order can only go once EVERY line has
 * one of its own (the server enforces the same rule in proofGateError), so
 * nobody approves a garment they never saw.
 */
export function useApprovalState(detail: Detail) {
  const status = detail.order.status as OrderStatus;

  const { pendingProofs, proofLines, missingProofLines, allLinesCovered } = useMemo(() => {
    const pending = detail.proofs.filter((p) => p.status === "pending");
    const lines = detail.lineItems.map((li, i) => {
      const colour = (li.colour ?? {}) as { name?: string };
      const name = li.product_name?.trim() || `Item ${i + 1}`;
      return { id: li.id, name, label: [name, colour.name].filter(Boolean).join(", ") };
    });
    // A one-line order also accepts an order-level (unassigned) proof: uploads
    // are pinned to the only line now, but older rows predate that.
    const orderLevel = pending.some((p) => !p.line_item_id);
    const covered = new Set(pending.map((p) => p.line_item_id).filter(Boolean) as string[]);
    const missing =
      lines.length === 1 && orderLevel ? [] : lines.filter((l) => !covered.has(l.id)).map((l) => l.name);
    return {
      pendingProofs: pending.length,
      proofLines: lines,
      missingProofLines: missing,
      // An order with no lines falls back to "is there any proof at all".
      allLinesCovered: lines.length === 0 ? pending.length > 0 : missing.length === 0,
    };
  }, [detail.lineItems, detail.proofs]);

  /** "Proofs on 1 of 3 items. Still missing: Dad Hat, Tote bag" */
  const coverageCaption = `Proofs on ${detail.lineItems.length - missingProofLines.length} of ${
    detail.lineItems.length
  } ${detail.lineItems.length === 1 ? "item" : "items"}. Still missing: ${nameList(missingProofLines)}`;

  /** Ready to send: a proof is waiting AND every line has one. */
  const canSend = pendingProofs > 0 && allLinesCovered;

  // When did the customer last get this order for approval, and has it been
  // edited since? Sends are either the move to proof_ready or an explicit
  // (re)send logged as approval_sent.
  const { lastSentAt, lastEditAt } = useMemo(() => {
    let sent: string | null = null;
    let edit: string | null = null;
    for (const a of detail.activity) {
      const to = (a.detail as { to?: string } | null)?.to;
      const isSend = a.type === "approval_sent" || (a.type === "status_change" && to === "proof_ready");
      if (isSend && (!sent || a.created_at > sent)) sent = a.created_at;
      if (EDIT_ACTIVITY.has(a.type) && (!edit || a.created_at > edit)) edit = a.created_at;
    }
    return { lastSentAt: sent, lastEditAt: edit };
  }, [detail.activity]);

  // The customer is looking at a stale version. Only while the order is still
  // open for approval, and only with a proof on file to send.
  const changedSinceSend =
    status === "proof_ready" && pendingProofs > 0 && !!lastSentAt && !!lastEditAt && lastEditAt > lastSentAt;

  return {
    pendingProofs,
    proofLines,
    missingProofLines,
    allLinesCovered,
    coverageCaption,
    canSend,
    lastSentAt,
    lastEditAt,
    changedSinceSend,
    alreadySent: status === "proof_ready",
    /** The panel under the items is showing (so the header can point at it). */
    panelVisible: canSend && SENDABLE.has(status),
  };
}

/**
 * "Send for approval" and a message to the customer in one place, under the
 * items where the proofs were just checked. The message posts to the customer
 * thread AND rides inside the approval email, so the customer gets one email.
 */
export function SendForApprovalPanel({ detail, who }: { detail: Detail; who: string }) {
  const { order } = detail;
  const { pending, run } = useOrderAction();
  const { alreadySent, panelVisible } = useApprovalState(detail);
  const [message, setMessage] = useState("");
  const [silent, setSilent] = useState(false);

  if (!panelVisible) return null;

  const total = ((order.pricing ?? {}) as { total?: number }).total ?? 0;

  function send() {
    run(
      () => sendForApprovalAction(order.id, { silent, message }),
      silent ? "Order updated, no email sent" : alreadySent ? "Sent to the customer again" : "Sent to customer for approval",
      () => {
        setMessage("");
        setSilent(false);
      },
    );
  }

  return (
    <Card id={SEND_PANEL_ID} className="scroll-mt-4 border-dream-purple/40">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-dream-ink">
          {alreadySent ? "Send for approval again" : "Send for approval"}
        </h2>

        <Textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label={`Message to ${who}`}
          placeholder={`Message to ${who} (optional), e.g. "Here's your proof, let me know if the placement looks right"`}
        />

        {!silent && total <= 0 && (
          <p className="rounded-lg border border-dream-warn/30 bg-dream-warn-soft px-3 py-2 text-xs text-dream-warn">
            This order has no total yet. The customer can approve but not pay, so set the pricing before sending.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Checkbox
            id="send-silent"
            checked={silent}
            onChange={(e) => setSilent(e.target.checked)}
            label="Don't email the customer, I'll send them the link"
          />
          <Button variant="primary" size="lg" loading={pending} onClick={send} className="w-full sm:w-auto sm:min-w-48">
            {silent ? "Send without email" : alreadySent ? "Send again" : "Send for approval"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
