import React from "react";
import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Shop | Dreamhouse Printing",
  description:
    "Browse custom apparel: shirts, hoodies, hats, totes and more. Design it your way and we'll print it.",
};

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-dream-cream">
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>
      {/* Reserve room so the footer's dog mascot (which pokes up out of the
          footer's top edge) never overlaps page content. */}
      <div className="pb-44 sm:pb-48">{children}</div>
      <SiteFooter />
    </div>
  );
}
