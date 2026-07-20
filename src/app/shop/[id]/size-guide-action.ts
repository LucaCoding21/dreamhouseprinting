"use server";

import { buildSizeGuide } from "@/lib/ss/sizeGuide";
import type { SizeGuide } from "@/lib/ss/types";

/**
 * Lazy-loaded by the SizeGuideModal on first open, so the S&S /specs/ call only
 * fires for shoppers who actually want the chart (not on every product view).
 * Returns null when there's no guide, the modal shows a friendly fallback.
 */
export async function loadSizeGuide(ssStyleId: string | null): Promise<SizeGuide | null> {
  if (!ssStyleId) return null;
  return buildSizeGuide(ssStyleId);
}
