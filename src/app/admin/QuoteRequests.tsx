"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { formatCAD } from "@/lib/money";
import { setQuoteStatusAction, convertQuoteToOrderAction } from "./quote-actions";

export interface QuoteRequestItem {
  id: string;
  quoteNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  message: string | null;
  total: number;
  thumbnail: string | null;
}

export function QuoteRequests({ quotes }: { quotes: QuoteRequestItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();

  function runConvert(quoteId: string) {
    setPendingId(quoteId);
    start(async () => {
      const res = await convertQuoteToOrderAction(quoteId);
      setPendingId(null);
      if (res.error) toast({ title: "Could not convert", description: res.error, variant: "error" });
      else {
        toast({ title: "Order created from quote", variant: "success" });
        if (res.orderId) router.push(`/admin/orders/${res.orderId}`);
        else router.refresh();
      }
    });
  }

  function runDecline(quoteId: string) {
    setPendingId(quoteId);
    start(async () => {
      const res = await setQuoteStatusAction(quoteId, "declined");
      setPendingId(null);
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Quote declined", variant: "success" });
        router.refresh();
      }
    });
  }

  return (
    <section id="q-quotes">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-lg font-bold text-dream-ink">Quote requests</h2>
        <Badge variant={quotes.length ? "purple" : "neutral"}>{quotes.length}</Badge>
      </div>
      {quotes.length === 0 ? (
        <div className="rounded-xl border border-dream-line bg-dream-surface">
          <EmptyState title="No open quote requests" description="Quotes saved from the designer land here." />
        </div>
      ) : (
        <ul className="divide-y divide-dream-line overflow-hidden rounded-xl border border-dream-line bg-dream-surface">
          {quotes.map((q) => {
            const busy = pendingId === q.id;
            return (
              <li key={q.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded border border-dream-line bg-dream-bg">
                  {q.thumbnail && (
                    <Image
                      src={q.thumbnail}
                      alt=""
                      width={44}
                      height={44}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-dream-ink">
                    {q.customerName ?? q.customerEmail ?? "New request"}
                  </div>
                  <div className="truncate text-xs text-dream-muted">
                    {q.message ?? q.quoteNumber ?? "-"}
                  </div>
                </div>
                <div className="hidden shrink-0 text-sm font-medium text-dream-ink sm:block">
                  {formatCAD(q.total)}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={busy}
                    disabled={busy}
                    onClick={() => runConvert(q.id)}
                  >
                    Convert
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={busy}
                    disabled={busy}
                    onClick={() => runDecline(q.id)}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
