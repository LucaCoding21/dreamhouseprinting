/**
 * One-off: add a "back" print area to existing apparel products so the designer
 * shows front + back side by side. Idempotent, skips products that already have
 * a back area, and skips caps (front-only). No S&S calls; pure DB.
 *
 *   node --env-file=.env.local scripts/add-back-print-areas.mjs
 */
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

// supabase-js initializes a realtime client on construction; Node < 22 has no
// global WebSocket, so provide one.
if (!globalThis.WebSocket) globalThis.WebSocket = ws;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Back print areas per family (mirrors PRINT_AREA in seed-catalog.mjs). Caps omitted.
const BACK = {
  shirts: { name: "Full back", position: { x: 0.24, y: 0.16, width: 0.52, height: 0.5 }, max_width_in: 14, max_height_in: 16 },
  hoodies: { name: "Full back", position: { x: 0.25, y: 0.18, width: 0.5, height: 0.44 }, max_width_in: 14, max_height_in: 16 },
  totes: { name: "Back center", position: { x: 0.29, y: 0.3, width: 0.42, height: 0.4 }, max_width_in: 12, max_height_in: 14 },
};

const { data: cats } = await supabase.from("categories").select("id, slug, parent_id");
const byId = new Map((cats ?? []).map((c) => [c.id, c]));
// Resolve a category/subcategory id to its top-level family slug.
function familySlug(id) {
  let c = byId.get(id);
  while (c && c.parent_id) c = byId.get(c.parent_id);
  return c?.slug ?? null;
}

const { data: products } = await supabase.from("products").select("id, name, category_id, subcategory_id");
let added = 0;
let skipped = 0;
for (const p of products ?? []) {
  const fam = familySlug(p.category_id) ?? familySlug(p.subcategory_id);
  const def = fam ? BACK[fam] : null;
  if (!def) {
    skipped++;
    continue;
  }
  const { data: existing } = await supabase
    .from("print_areas")
    .select("id")
    .eq("product_id", p.id)
    .eq("view", "back")
    .maybeSingle();
  if (existing) {
    skipped++;
    continue;
  }
  const { error } = await supabase.from("print_areas").insert({
    product_id: p.id,
    name: def.name,
    view: "back",
    position: def.position,
    max_width_in: def.max_width_in,
    max_height_in: def.max_height_in,
    px_per_inch: 0,
    display_order: 1,
  });
  if (error) {
    console.error(`✗ ${p.name}: ${error.message}`);
    continue;
  }
  console.log(`✓ back area added  ${p.name}  [${fam}]`);
  added++;
}
console.log(`\nDone. Added ${added}, skipped ${skipped}.`);
