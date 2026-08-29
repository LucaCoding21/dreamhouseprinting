"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import { deleteDesignAction } from "./actions";

/** Trash affordance for a draft design card. Sits as a sibling of the card's
 *  <Link> (not nested inside it) so the anchor stays valid; opens a confirm
 *  dialog before calling the guarded server action. */
export function DeleteDesignButton({ designId, name }: { designId: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirmDelete() {
    start(async () => {
      const res = await deleteDesignAction(designId);
      if (res.error) {
        toast({ title: "Couldn't delete design", description: res.error, variant: "error" });
        return;
      }
      toast({ title: "Draft deleted", variant: "success" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete draft ${name}`}
        title="Delete draft"
        className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-dream-line bg-white/90 sm:right-3 sm:top-3 text-dream-muted shadow-sm backdrop-blur transition-colors hover:border-dream-danger hover:text-dream-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-danger/40"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
        </svg>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription>
              {name ? `"${name}" ` : "This draft "}will be removed for good. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Keep it
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={pending}>
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
