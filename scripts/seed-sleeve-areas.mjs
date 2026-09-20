#!/usr/bin/env node
/**
 * Adds a default "Sleeve" print area to active shirts + hoodies whose S&S data
 * ships a side photo for at least one colourway, so sleeve designing works in
 * the designer TODAY. Julian fine-tunes the box in Admin -> product -> Print
 * areas (the editor already supports the Sleeve view over the side image).
 *
 * Why gated on a side photo: the designer only turns the sleeve into a live
 * editable view when a colourway has a real S&S "side" image to design against
 * (see DesignerClient `sleeveEnabled`). A sleeve area on a product with no side
 * photo anywhere would never surface, so we skip those.
 *
 * The default envelope is positioned over the upper-arm region of the 500x625
 * S&S side photos (roughly centered horizontally, upper third vertically) at a
 * 4in x 3.5in max print. The designer aspect-corrects the box at runtime
 * (lib/design/printArea effectivePrintBox), so a drifted envelope degrades
 * gracefully and the review measurement stays believable.
 *
 * Idempotent: a product that already has a sleeve-family print area
 * (left_sleeve / right_sleeve / sleeve) is left untouched. Re-running only adds
 * the area to products that still lack one.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-sleeve-areas.mjs         # writes
 *   node --env-file=.env.local scripts/seed-sleeve-areas.mjs --dry   # report only
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes("--dry");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Categories that get a default sleeve area (apparel with sleeves).
const TARGET_CATEGORY_SLUGS = ["shirts", "hoodies"];

// Default sleeve zone. `position` is a normalized 0..1 envelope over the S&S
// side photo (upper-arm region); maxWidthIn x maxHeightIn is the physical print.
// A typical sleeve print is about 3.5in square, comfortably inside 4 x 3.5.
const SLEEVE_AREA = {
  name: "Sleeve",
  view: "sleeve", // migration 0001 enum accepts 'sleeve'; normView() maps it back
  position: { x: 0.4, y: 0.26, width: 0.18, height: 0.15 },
  maxWidthIn: 4,
  maxHeightIn: 3.5,
};

const SLEEVE_VIEWS = new Set(["sleeve", "left_sleeve", "right_sleeve"]);

function colourwaysWithSide(colours) {
  if (!Array.isArray(colours)) return 0;
  return colours.filter((c) => c?.images?.side).length;
}

async function main() {
  // Category slug -> id.
  const { data: cats, error: catErr } = await supabase.from("categories").select("id, slug");
  if (catErr) throw catErr;
  const targetCatIds = cats
    .filter((c) => TARGET_CATEGORY_SLUGS.includes(c.slug))
    .map((c) => c.id);
  if (targetCatIds.length === 0) {
    console.error(`No categories found for slugs: ${TARGET_CATEGORY_SLUGS.join(", ")}`);
    process.exit(1);
  }

  // Active shirts + hoodies.
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, colours, category_id")
    .eq("is_active", true)
    .in("category_id", targetCatIds);
  if (prodErr) throw prodErr;

  console.log(`${DRY ? "[dry] " : ""}Scanning ${products.length} active shirts/hoodies for sleeve setup...\n`);

  let added = 0;
  let skippedExisting = 0;
  let skippedNoSide = 0;

  for (const p of products) {
    const sideCount = colourwaysWithSide(p.colours);
    if (sideCount === 0) {
      skippedNoSide++;
      console.log(`-  ${p.name}: no side photo on any colourway, skipped`);
      continue;
    }

    // Existing print areas for this product (idempotency + display_order).
    const { data: existing, error: paErr } = await supabase
      .from("print_areas")
      .select("id, view, display_order")
      .eq("product_id", p.id);
    if (paErr) throw paErr;

    if ((existing ?? []).some((a) => SLEEVE_VIEWS.has(a.view))) {
      skippedExisting++;
      console.log(`=  ${p.name}: already has a sleeve area, left as-is`);
      continue;
    }

    const nextOrder =
      (existing ?? []).reduce((m, a) => Math.max(m, a.display_order ?? 0), -1) + 1;
    const row = {
      product_id: p.id,
      name: SLEEVE_AREA.name,
      view: SLEEVE_AREA.view,
      position: SLEEVE_AREA.position,
      max_width_in: SLEEVE_AREA.maxWidthIn,
      max_height_in: SLEEVE_AREA.maxHeightIn,
      px_per_inch: 0, // designer derives scale from the box + image
      display_order: nextOrder,
    };

    if (DRY) {
      added++;
      console.log(`+  ${p.name}: would add Sleeve area (${sideCount} colourway(s) with a side photo)`);
      continue;
    }

    const { error: insErr } = await supabase.from("print_areas").insert(row);
    if (insErr) throw insErr;
    added++;
    console.log(`+  ${p.name}: added Sleeve area (${sideCount} colourway(s) with a side photo)`);
  }

  console.log(
    `\n${DRY ? "[dry] " : ""}Done. ${added} ${DRY ? "would be " : ""}added, ${skippedExisting} already had one, ${skippedNoSide} had no side photo.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
