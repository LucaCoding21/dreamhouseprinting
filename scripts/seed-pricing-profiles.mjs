#!/usr/bin/env node
/**
 * Seeds shared decoration pricing profiles and backfills every product onto one.
 *
 * A profile is the validated all-inclusive tier prices for ONE reference blank.
 * Products in the same family point at the profile and carry only their own
 * blank (wholesale + markup); their customer curve is COMPILED as
 *   tier(qty) = profile.tiers[deco](qty) + (myRetail - refRetail)
 * and written back to products.pricing_rules.quote, so the storefront/designer/
 * order surfaces are untouched. The reference product reproduces the validated
 * curve exactly (shift 0); siblings shift by their real blank-cost gap the
 * fix for four tees at four blank costs all shipping one identical table.
 *
 * MIRRORS src/lib/pricing/profile.ts (compile) and src/lib/pricing/platform.ts
 * (garmentRetailUnit). Those are server-only TS; the math is duplicated here on
 * purpose. Keep in sync if the compile changes.
 *
 * Idempotent: upserts profiles by slug, re-assigns + recompiles every run.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-pricing-profiles.mjs        # writes
 *   node --env-file=.env.local scripts/seed-pricing-profiles.mjs --dry  # preview
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const QUOTE_CURVES = JSON.parse(readFileSync(join(HERE, "quote-curves.json"), "utf8"));

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes("--dry");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/seed-pricing-profiles.mjs");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const MIN_TIER_PRICE = 0.5;
const roundCents = (n) => Math.round(n * 100) / 100;

// Profile definitions. `setup` is the informational one-time fee per method. The
// reference blank cost (which the tiers are calibrated for) is derived at run
// time as the CHEAPEST blank in the family, so every other product shifts UP
// (never below cost) the model errs high, which protects margin.
const PROFILES = [
  { slug: "tee-standard",      name: "T-shirt · screen + embroidery", curve: "t-shirts",  setup: { screen: 25, embroidery: 50 } },
  { slug: "hoodie-standard",   name: "Hoodie · screen + embroidery",  curve: "hoodies",   setup: { screen: 25, embroidery: 50 } },
  { slug: "crewneck-standard", name: "Crewneck · screen + embroidery",curve: "crewnecks", setup: { screen: 25, embroidery: 50 } },
  { slug: "tote-standard",     name: "Tote bag · screen + embroidery",curve: "tote-bags", setup: { screen: 25, embroidery: 50 } },
  { slug: "cap-embroidery",    name: "Cap · embroidery",              curve: "dad-cap",   setup: { embroidery: 50 } },
  { slug: "beanie-embroidery", name: "Beanie · embroidery",           curve: "toque",     setup: { embroidery: 50 } },
];

// Product → profile family (from the catalog seed's `curve` mapping), matched by
// part number / style name / product name substring.
const PRODUCT_FAMILY = [
  { match: "3001", slug: "tee-standard" },
  { match: "5000", slug: "tee-standard" },
  { match: "6210", slug: "tee-standard" },
  { match: "1717", slug: "tee-standard" },
  { match: "64000", slug: "tee-standard" },
  { match: "18500", slug: "hoodie-standard" },
  { match: "SS4500", slug: "hoodie-standard" },
  { match: "3729", slug: "hoodie-standard" },
  { match: "3739", slug: "hoodie-standard" },
  { match: "18000", slug: "crewneck-standard" },
  { match: "Q1300", slug: "tote-standard" },
  { match: "Q1500", slug: "tote-standard" },
  { match: "Q4500", slug: "tote-standard" },
  { match: "6245PT", slug: "cap-embroidery" },
  { match: "6277", slug: "cap-embroidery" },
  { match: "112", slug: "cap-embroidery" },
  { match: "SP12", slug: "beanie-embroidery" },
];

function garmentRetail(wholesale, markupType, markupValue) {
  const cost = wholesale ?? 0;
  const m = markupValue ?? 0;
  return roundCents(markupType === "flat" ? cost + m : cost * (1 + m / 100));
}
function blankShift(product, refWholesale) {
  if (refWholesale == null) return 0;
  const mine = garmentRetail(product.wholesale_cost, product.markup_type, product.markup_value);
  const ref = garmentRetail(refWholesale, product.markup_type, product.markup_value);
  return roundCents(mine - ref);
}
function compile(product, profile) {
  const shift = blankShift(product, profile.ref_wholesale);
  const breaks = {};
  for (const d of profile.decorations) {
    breaks[d] = (profile.tiers[d] ?? [])
      .map((t) => ({ minQty: t.minQty, price: roundCents(Math.max(MIN_TIER_PRICE, t.price + shift)) }))
      .sort((a, b) => a.minQty - b.minQty);
  }
  return { decorations: profile.decorations, breaks };
}

function idText(p) {
  return [p.ss_part_number, p.ss_style_name, p.name].filter(Boolean).join(" ");
}
function familyFor(p) {
  const hay = idText(p);
  const hit = PRODUCT_FAMILY.find((f) => hay.includes(f.match));
  return hit?.slug ?? null;
}

async function main() {
  const { data: products, error } = await db
    .from("products")
    .select("id, name, ss_part_number, ss_style_name, wholesale_cost, markup_type, markup_value, pricing_rules")
    .order("name");
  if (error) throw new Error(error.message);

  // Reference wholesale per family = the cheapest blank assigned to it, so every
  // other product shifts UP from the validated curve (never below cost).
  const minWholesaleByFamily = new Map();
  for (const p of products) {
    const slug = familyFor(p);
    if (!slug || p.wholesale_cost == null) continue;
    const cur = minWholesaleByFamily.get(slug);
    if (cur == null || p.wholesale_cost < cur) minWholesaleByFamily.set(slug, p.wholesale_cost);
  }

  const built = [];
  for (const def of PROFILES) {
    const curve = QUOTE_CURVES[def.curve];
    if (!curve) { console.log(`  ! no curve "${def.curve}"`); continue; }
    const ref = minWholesaleByFamily.get(def.slug) ?? null;
    if (ref == null) console.log(`  ! no products found for ${def.slug} shift will be 0`);
    built.push({
      slug: def.slug,
      name: def.name,
      decorations: curve.decorations,
      ref_wholesale: ref,
      setup: def.setup,
      tiers: curve.breaks,
      is_active: true,
    });
  }

  console.log(`\nProfiles (${built.length}):`);
  for (const p of built) console.log(`  ${p.slug.padEnd(20)} ref $${p.ref_wholesale ?? "?"}  [${p.decorations.join(", ")}]`);

  if (DRY) {
    console.log("\n--dry: assignment preview");
    for (const p of products) {
      const slug = familyFor(p);
      console.log(`  ${(p.name ?? "").slice(0, 42).padEnd(44)} -> ${slug ?? "(no family, left as-is)"}`);
    }
    return;
  }

  // Upsert profiles by slug, then read them back to get ids.
  const { error: upErr } = await db
    .from("pricing_profiles")
    .upsert(built.map((b) => ({ ...b, updated_at: new Date().toISOString() })), { onConflict: "slug" });
  if (upErr) throw new Error(`profiles upsert: ${upErr.message}`);
  const { data: saved } = await db.from("pricing_profiles").select("*");
  const bySlug = new Map((saved ?? []).map((p) => [p.slug, p]));

  // Assign + recompile every product that maps to a family.
  let assigned = 0;
  for (const p of products) {
    const slug = familyFor(p);
    if (!slug) continue;
    const profile = bySlug.get(slug);
    if (!profile) continue;
    const quote = compile(p, profile);
    const rules = { ...(p.pricing_rules ?? {}), profileId: profile.id, quote };
    const { error: uErr } = await db.from("products").update({ pricing_rules: rules }).eq("id", p.id);
    if (uErr) { console.log(`  ! ${p.name}: ${uErr.message}`); continue; }
    const shift = blankShift(p, profile.ref_wholesale);
    console.log(`  ${(p.name ?? "").slice(0, 42).padEnd(44)} -> ${slug}  shift ${shift >= 0 ? "+" : ""}$${shift.toFixed(2)}`);
    assigned++;
  }
  console.log(`\nDone. ${built.length} profiles, ${assigned} products assigned + recompiled.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
