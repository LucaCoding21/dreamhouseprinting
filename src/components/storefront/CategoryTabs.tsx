"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent, EmptyState } from "@/components/ui";
import { ProductCard } from "./ProductCard";
import type { ProductRow } from "@/lib/db/rows";

export interface CategoryTab {
  /** Stable key used as the Tabs value (a slug or "all"). */
  value: string;
  label: string;
  products: ProductRow[];
}

/**
 * Shop All tab strip (PRD §3.3.1): clicking a tab swaps the product grid in
 * place — no page reload. The server pre-fetches each major category's products
 * and hands them in as props; this client component just switches between the
 * already-loaded lists.
 */
export function CategoryTabs({ tabs }: { tabs: CategoryTab[] }) {
  const first = tabs[0]?.value ?? "all";
  return (
    <Tabs defaultValue={first}>
      <TabsList className="overflow-x-auto">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="whitespace-nowrap">
            {t.label}
            <span className="ml-1.5 text-xs text-dream-faint">
              {t.products.length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {t.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing here yet"
              description={`No ${t.label.toLowerCase()} products are available right now — check back soon.`}
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
