import { notFound } from "next/navigation";
import { loadCheckoutContext } from "./context";
import { CheckoutClient } from "./CheckoutClient";

export const metadata = { title: "Checkout | Dreamhouse Printing" };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ designId: string }>;
}) {
  const { designId } = await params;
  // Auth (logged-in owner or matching guest cookie) is resolved in the loader.
  const ctx = await loadCheckoutContext(designId);
  if (!ctx) notFound();

  return (
    <CheckoutClient designId={ctx.designId} summary={ctx.summary} contact={ctx.contact} footnote={ctx.checkout.footnote} />
  );
}
