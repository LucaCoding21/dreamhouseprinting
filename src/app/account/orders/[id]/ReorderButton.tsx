"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/use-toast";
import { reorderAction } from "./reorder-action";

export function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="md"
      className="shadow-[0_1px_1px_0_rgba(27,20,88,0.05)]"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await reorderAction(orderId);
          if (r.error || !r.orderId) {
            toast({ title: "Couldn’t reorder", description: r.error, variant: "error" });
            return;
          }
          toast({ title: "Order placed", description: "We’ve started a fresh order from this one.", variant: "success" });
          router.push(`/account/orders/${r.orderId}`);
        })
      }
    >
      Reorder
    </Button>
  );
}
