"use client";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/db/rows";

/**
 * Confirmation for moving an order BACKWARDS through its lifecycle (e.g. back
 * to the proof stage from production for a reprint). Forward moves never ask.
 * Shared by the status stepper and the jump-to-status list.
 */
export function StatusChangeConfirm({
  open,
  onOpenChange,
  from,
  to,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: OrderStatus;
  to: OrderStatus | null;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move back to &ldquo;{to ? STATUS_META[to].label : ""}&rdquo;?</DialogTitle>
          <DialogDescription>
            This order goes from {STATUS_META[from].label} back to {to ? STATUS_META[to].label : ""}. The customer gets the
            same email they would for any other status change, so only do this when they should hear about it (a reprint, a
            proof that needs redoing). The move is recorded in the order activity log.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} onClick={onConfirm}>
            Move back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
