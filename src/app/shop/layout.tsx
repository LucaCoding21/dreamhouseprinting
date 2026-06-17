import React, { Suspense } from "react";
import type { Metadata } from "next";
import { StorefrontNav } from "@/components/storefront/StorefrontNav";

export const metadata: Metadata = {
  title: "Shop — Dreamhouse Printing",
  description:
    "Browse custom apparel — shirts, hoodies, hats, totes and more. Design it your way and we'll print it.",
};

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-dream-bg">
      <Suspense fallback={<div className="h-16 border-b border-dream-line bg-dream-surface" />}>
        <StorefrontNav />
      </Suspense>
      {children}
    </div>
  );
}
