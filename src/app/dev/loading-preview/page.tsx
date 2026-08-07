import { notFound } from "next/navigation";
import { OrderPlacingOverlay } from "@/components/OrderPlacingOverlay";

/**
 * Dev-only preview of the order-placing loading screen, so nobody has to
 * place a real order just to look at it. Refresh the page to replay the
 * animation. 404s in production.
 */
export const metadata = { title: "Loading screen preview" };

export default function LoadingPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <OrderPlacingOverlay plural={false} />;
}
