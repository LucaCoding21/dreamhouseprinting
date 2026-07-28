"use client";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/use-toast";

/**
 * Bottom-of-page escape hatch: open the exact page the customer sees (the
 * tokenized public order view), or copy that link to send it to them.
 */
export function CustomerLinkFooter({ publicToken }: { publicToken: string | null }) {
  const { toast } = useToast();
  if (!publicToken) return null;
  const href = `/o/${publicToken}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`);
      toast({ title: "Order link copied", variant: "success" });
    } catch {
      toast({ title: "Could not copy link", variant: "error" });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-dream-line pt-6">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-dream-purple hover:underline"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M14 4h6v6" />
          <path d="M20 4l-8 8" />
          <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
        View this order as the customer sees it
      </a>
      <Button variant="secondary" size="sm" onClick={copyLink}>
        Copy customer link
      </Button>
      <span className="text-xs text-dream-faint">No login needed, anyone with the link can view and pay.</span>
    </div>
  );
}
