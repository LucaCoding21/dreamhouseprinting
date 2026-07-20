import type React from "react";

/** Common print-colour names -> hex, for splitting two-tone swatches like "Natural/Black". */
const COLOUR_HEX: Record<string, string> = {
  natural: "#e7dcc4",
  black: "#1a1a1a",
  navy: "#1b2a4a",
  white: "#f5f5f0",
  red: "#c0202e",
  royal: "#1f49a8",
  grey: "#8b8d90",
  gray: "#8b8d90",
  charcoal: "#3a3d42",
  forest: "#1e4332",
  green: "#1f7a3f",
  maroon: "#5c1a28",
  khaki: "#bba265",
  tan: "#cdb894",
  brown: "#5a3d29",
  pink: "#e89bb4",
  purple: "#6b4bb3",
  orange: "#e07b2a",
  yellow: "#f2c94c",
};

function nameToHex(part: string): string | null {
  const key = part.trim().toLowerCase();
  if (COLOUR_HEX[key]) return COLOUR_HEX[key];
  // Match on a known word inside a longer name (e.g. "heather navy").
  const word = Object.keys(COLOUR_HEX).find((k) => key.includes(k));
  return word ? COLOUR_HEX[word] : null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Perceived lightness, 0 (black) .. 1 (white). */
function luminance([r, g, b]: [number, number, number]): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Most-requested custom-apparel colours, in popularity order. A colour whose
 * name contains one of these keywords sorts to the front; everything else
 * trails behind, ordered light -> dark. Specific names (e.g. "sport grey")
 * come before generic ones so they win the first-match.
 */
const STAPLE_KEYWORDS = [
  "white",
  "black",
  "navy",
  "sport grey",
  "sport gray",
  "heather",
  "charcoal",
  "grey",
  "gray",
  "red",
  "royal",
  "blue",
  "green",
  "forest",
  "maroon",
  "gold",
  "yellow",
  "orange",
  "purple",
  "pink",
];

function colourRank(c: { name: string; hex: string }): number {
  const name = c.name.toLowerCase();
  const staple = STAPLE_KEYWORDS.findIndex((k) => name.includes(k));
  if (staple >= 0) return staple;
  // Non-staples land after every staple, ordered light -> dark.
  const rgb = hexToRgb(c.hex) ?? hexToRgb(nameToHex(c.name) ?? "");
  const l = rgb ? luminance(rgb) : 0.5;
  return STAPLE_KEYWORDS.length + (1 - l);
}

/**
 * Order swatches most-popular to least-popular: black/white/neutral staples and
 * primary colours first, then the long tail light -> dark. Stable for ties.
 */
export function sortColours<T extends { name: string; hex: string }>(colours: T[]): T[] {
  return colours
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const d = colourRank(a.c) - colourRank(b.c);
      return d !== 0 ? d : a.i - b.i;
    })
    .map((x) => x.c);
}

/**
 * A colour that reads as "blank" on the white product card, pure whites and the
 * palest naturals. Used so cards don't all default to their white colorway (a
 * white shirt on a white card looks like an empty tile).
 */
export function isNearWhite(c: { name: string; hex: string | null }): boolean {
  if (/\b(white|natural|ivory|cream)\b/i.test(c.name)) return true;
  const rgb = hexToRgb(c.hex ?? "") ?? hexToRgb(nameToHex(c.name) ?? "");
  return rgb ? luminance(rgb) >= 0.85 : false;
}

/**
 * The colour whose front image best represents a product on a card: the owner's
 * pinned pick (`primary`), else the most-popular non-near-white colour, else any
 * colour with a front image. Returns undefined if none have a front image.
 */
export function heroColour<
  T extends { name: string; hex: string; images?: { front: string | null } | null; primary?: boolean }
>(colours: T[]): T | undefined {
  const withFront = colours.filter((c) => c.images?.front);
  if (withFront.length === 0) return undefined;
  const pinned = withFront.find((c) => c.primary);
  if (pinned) return pinned;
  const sorted = sortColours(withFront);
  return sorted.find((c) => !isNearWhite(c)) ?? sorted[0];
}

/**
 * Build the swatch background. Two-tone colours ("Natural/Black") render as a
 * diagonal split, body colour on one half, trim colour on the other.
 */
export function swatchStyle(c: { name: string; hex: string | null }): React.CSSProperties {
  const base = c.hex || "#ddd";
  const parts = c.name.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const a = nameToHex(parts[0]) ?? base;
    const b = nameToHex(parts[1]) ?? base;
    if (a !== b) {
      return { background: `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)` };
    }
  }
  return { backgroundColor: base };
}
