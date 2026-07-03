#!/usr/bin/env node
/**
 * Generates scripts/quote-curves.json from the BASE_PRICE / AVAILABLE_DECORATIONS
 * tables in src/lib/pricing.ts (the legacy quick-quote curves — Julian's real
 * per-quantity prices). seed-catalog.mjs reads that JSON to stamp each catalog
 * product's `pricing_rules.quote`. This keeps lib/pricing.ts the single source
 * of truth while letting the plain-Node seed (which can't import the TS module)
 * stay in sync.
 *
 * Run after editing the BASE_PRICE tables in lib/pricing.ts:
 *   node scripts/gen-quote-curves.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../src/lib/pricing.ts"), "utf8");

/** Slice out a `const NAME ... = { ... }` object literal by brace-matching. */
function objectLiteral(name) {
  const at = src.indexOf(name);
  const open = src.indexOf("= {", at) + 2;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      const lit = src.slice(open, i + 1).replace(/\/\/[^\n]*/g, "");
      return eval("(" + lit + ")");
    }
  }
  throw new Error(`could not parse ${name}`);
}

const BASE_PRICE = objectLiteral("const BASE_PRICE");
const AVAILABLE_DECORATIONS = objectLiteral("AVAILABLE_DECORATIONS");

const out = {};
for (const p of Object.keys(BASE_PRICE)) {
  const decorations = AVAILABLE_DECORATIONS[p];
  const breaks = {};
  for (const d of decorations) {
    if (BASE_PRICE[p][d]) {
      breaks[d] = BASE_PRICE[p][d].map(([minQty, price]) => ({ minQty, price }));
    }
  }
  out[p] = { decorations, breaks };
}

const dest = join(here, "quote-curves.json");
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${Object.keys(out).length} curves to ${dest}`);
