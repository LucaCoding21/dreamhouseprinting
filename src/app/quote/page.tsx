import type { Metadata } from "next";
import QuoteForm from "@/components/QuoteForm";

export const metadata: Metadata = {
  title: "Get a Quote — Dreamhouse Printing",
  description:
    "Custom print quotes for shirts, hoodies, hats and more. Tell us what you need and Julian will get back to you within 24 hours.",
};

export default function QuotePage() {
  return (
    <main className="relative">
      <QuoteForm />
    </main>
  );
}
