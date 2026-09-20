/**
 * Per-unit add-on charges Julian can tweak from Admin, Settings, Add-ons.
 * Stored in the `settings` table under key "addons". Applied to the order total
 * (not the customer's self-serve quote) when the matching per-line checkbox is
 * ticked, multiplied by the line quantity. See syncOrderPricing.
 */
export interface AddonSettings {
  /** Individual bagging, per garment. */
  baggingPerUnit: number;
  /** Sewn-on size tags, per garment. */
  sewnTagsPerUnit: number;
  /** Spot-process print, per garment per flagged print spot. */
  spotProcessPerUnit: number;
}

export const DEFAULT_ADDON_SETTINGS: AddonSettings = {
  baggingPerUnit: 0,
  sewnTagsPerUnit: 0,
  spotProcessPerUnit: 0,
};

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Merge a stored settings blob over the defaults (defaults win for missing keys). */
export function mergeAddonSettings(raw: unknown): AddonSettings {
  const v = (raw ?? {}) as Partial<AddonSettings>;
  return {
    baggingPerUnit: num(v.baggingPerUnit, DEFAULT_ADDON_SETTINGS.baggingPerUnit),
    sewnTagsPerUnit: num(v.sewnTagsPerUnit, DEFAULT_ADDON_SETTINGS.sewnTagsPerUnit),
    spotProcessPerUnit: num(v.spotProcessPerUnit, DEFAULT_ADDON_SETTINGS.spotProcessPerUnit),
  };
}

/** Add-on surcharge for one line, given its decorations and quantity. */
export function lineAddonTotal(
  dec: { bagging?: boolean; sewnTags?: boolean; spots?: { spotProcess?: boolean }[] },
  qty: number,
  s: AddonSettings,
): number {
  if (qty <= 0) return 0;
  let total = 0;
  if (dec.bagging) total += s.baggingPerUnit * qty;
  if (dec.sewnTags) total += s.sewnTagsPerUnit * qty;
  const spotProcessSpots = (dec.spots ?? []).filter((sp) => sp?.spotProcess).length;
  total += s.spotProcessPerUnit * qty * spotProcessSpots;
  return total;
}
