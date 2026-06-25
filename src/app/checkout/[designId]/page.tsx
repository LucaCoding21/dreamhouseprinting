import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { loadCheckoutContext } from "./context";
import { CheckoutClient } from "./CheckoutClient";

export const metadata = { title: "Checkout — Dreamhouse Printing" };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ designId: string }>;
}) {
  const { designId } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/checkout/${designId}`);

  const ctx = await loadCheckoutContext(designId, user.id, user.email ?? null);
  if (!ctx) notFound();

  return (
    <CheckoutClient designId={ctx.designId} summary={ctx.summary} contact={ctx.contact} footnote={ctx.checkout.footnote} />
  );
}
