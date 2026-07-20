import { notFound, redirect } from "next/navigation";
import { loadReviewContext } from "../context";
import { ReviewClient } from "./ReviewClient";
import { addBusinessDays, fmtDate } from "@/lib/turnaround";

export const metadata = { title: "Order review | Dreamhouse Printing" };

export default async function ReviewStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ designId: string }>;
  searchParams: Promise<{ fulfillment?: string; turnaround?: string; neededBy?: string }>;
}) {
  const { designId } = await params;
  const sp = await searchParams;
  const ctx = await loadReviewContext(designId);
  if (!ctx) notFound();
  if (!ctx.hasAddress) redirect(`/checkout/${designId}`);

  const fulfillment = sp.fulfillment === "pickup" ? "pickup" : "ship";
  const turnaround = sp.turnaround === "rush" ? "rush" : "standard";
  // Customer's requested need-by date (only meaningful on a rush). Validate the
  // YYYY-MM-DD shape so a hand-edited URL can't smuggle junk into the order.
  const neededBy = turnaround === "rush" && /^\d{4}-\d{2}-\d{2}$/.test(sp.neededBy ?? "") ? sp.neededBy! : null;

  // Projected timeline (estimates, Julian confirms the real dates on the proof).
  const today = new Date();
  const lead = ctx.leadTimeDays;
  const mockup = addBusinessDays(today, 1);
  const shipStart = addBusinessDays(today, lead + 1);
  const shipEnd = addBusinessDays(today, lead + 3);
  const handStart = addBusinessDays(shipStart, 2);
  const handEnd = addBusinessDays(shipEnd, 4);

  const timeline = [
    { icon: "created", label: "Order created", detail: fmtDate(today) },
    { icon: "mockup", label: "Mockup for approval", detail: `Expected by ${fmtDate(mockup)}` },
    { icon: "printing", label: "Printing", detail: `~${lead} business days` },
    fulfillment === "pickup"
      ? { icon: "store", label: "Ready for pickup", detail: `${fmtDate(shipStart)} – ${fmtDate(shipEnd)}` }
      : { icon: "ship", label: "Ship out", detail: `${fmtDate(shipStart)} – ${fmtDate(shipEnd)}` },
    {
      icon: "box",
      label: fulfillment === "pickup" ? "Pickup window" : "In hands",
      detail: `${fmtDate(handStart)} – ${fmtDate(handEnd)}`,
    },
  ];

  return <ReviewClient ctx={ctx} fulfillment={fulfillment} turnaround={turnaround} neededBy={neededBy} timeline={timeline} />;
}
