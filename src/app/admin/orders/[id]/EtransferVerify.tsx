"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { formatCAD } from "@/lib/money";
import { confirmEtransferAction, etransferNotReceivedAction } from "../actions";
import { fmtWhen, useOrderAction } from "./shared";

/**
 * The admin side of the e-transfer flow: the customer clicked "I've sent it",
 * now Julian checks the bank and either confirms (marks the order paid, and by
 * default moves an approved order into production) or flags it as not
 * received (which reopens the customer's payment options and can send them a
 * heads-up note). Rendered in the Payment card; `compact` renders just the
 * two buttons for the command header hero.
 */
export function EtransferVerify({
  orderId,
  amount,
  reportedAt,
  orderStatus,
  compact = false,
}: {
  orderId: string;
  amount: number;
  reportedAt: string;
  orderStatus: string;
  compact?: boolean;
}) {
  const { pending, run } = useOrderAction();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notReceivedOpen, setNotReceivedOpen] = useState(false);
  // Confirming payment on an approved order almost always means "go print it".
  const [startProduction, setStartProduction] = useState(orderStatus === "approved");
  const [customerMessage, setCustomerMessage] = useState("");

  function confirm() {
    run(
      () => confirmEtransferAction(orderId, startProduction && orderStatus === "approved"),
      startProduction && orderStatus === "approved" ? "Payment confirmed, order moved to production" : "Payment confirmed",
      () => setConfirmOpen(false),
    );
  }

  function notReceived() {
    run(
      () => etransferNotReceivedAction(orderId, customerMessage),
      "Marked as not received",
      () => {
        setNotReceivedOpen(false);
        setCustomerMessage("");
      },
    );
  }

  const buttons = (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" className={compact ? "" : "flex-1"} loading={pending} onClick={() => setConfirmOpen(true)}>
        Confirm received
      </Button>
      <Button variant="secondary" className={compact ? "" : "flex-1"} loading={pending} onClick={() => setNotReceivedOpen(true)}>
        Not received
      </Button>
    </div>
  );

  return (
    <>
      {compact ? (
        buttons
      ) : (
        <div className="space-y-2.5 rounded-lg border border-dream-warn/40 bg-dream-warn-soft p-3">
          <p className="text-sm text-dream-warn">
            <strong>E-transfer to verify:</strong> the customer says they sent {formatCAD(amount)} on{" "}
            {fmtWhen(reportedAt)}. Check your bank inbox for the deposit.
          </p>
          {buttons}
        </div>
      )}

      {/* Confirm received */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm the e-transfer landed?</DialogTitle>
            <DialogDescription>
              This marks the order paid in full ({formatCAD(amount)}) and emails the customer a payment confirmation.
              Only confirm after the deposit shows in your bank.
            </DialogDescription>
          </DialogHeader>
          {orderStatus === "approved" && (
            <div className="px-5 pb-2">
              <Checkbox
                checked={startProduction}
                onChange={(e) => setStartProduction(e.target.checked)}
                label="Start production now (proof is approved and it's paid)"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={confirm}>
              Confirm payment received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Not received */}
      <Dialog open={notReceivedOpen} onOpenChange={setNotReceivedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>E-transfer not received?</DialogTitle>
            <DialogDescription>
              This clears the pending e-transfer so the customer&rsquo;s order page offers payment again. Add a note to
              let them know what to check (sent to their inbox and shown on their order page), or leave it blank.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-2">
            <Textarea
              rows={3}
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              placeholder="e.g. We haven't seen your e-transfer yet. Double-check it went to the right email, or pay by card from your order page."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotReceivedOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={notReceived}>
              Mark not received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
