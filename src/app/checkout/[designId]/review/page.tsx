import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { loadReviewContext } from "../context";
import { ReviewClient } from "./ReviewClient";

export const metadata = { title: "Order review — Dreamhouse Printing" };

/** Skip weekends so projected dates land on business days. */
function addBusinessDays(date: Date, n: number): Date {
  const d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ReviewStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ designId: string }>;
  searchParams: Promise<{ fulfillment?: string; turnaround?: string }>;
}) {
  const { designId } = await params;
  const sp = await searchParams;
  const user = await getUser();
  if (!user) redirect(`/login?next=/checkout/${designId}/review`);

  const ctx = await loadReviewContext(designId, user.id, user.email ?? null);
  if (!ctx) notFound();
  if (!ctx.hasAddress) redirect(`/checkout/${designId}`);

  const fulfillment = sp.fulfillment === "pickup" ? "pickup" : "ship";
  const turnaround = sp.turnaround === "rush" ? "rush" : "standard";

  // Projected timeline (estimates — Julian confirms the real dates on the proof).
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

  return <ReviewClient ctx={ctx} fulfillment={fulfillment} turnaround={turnaround} timeline={timeline} />;
}
