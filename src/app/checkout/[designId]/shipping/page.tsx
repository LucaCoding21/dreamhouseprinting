import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { loadCheckoutContext } from "../context";
import { ShippingClient } from "./ShippingClient";

export const metadata = { title: "Shipping — Dreamhouse Printing" };

export default async function ShippingStepPage({
  params,
}: {
  params: Promise<{ designId: string }>;
}) {
  const { designId } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/checkout/${designId}/shipping`);

  const ctx = await loadCheckoutContext(designId, user.id, user.email ?? null);
  if (!ctx) notFound();
  // Can't pick delivery before we have contact details — send them back.
  if (!ctx.hasAddress) redirect(`/checkout/${designId}`);

  return (
    <ShippingClient designId={ctx.designId} summary={ctx.summary} province={ctx.province} checkout={ctx.checkout} />
  );
}
