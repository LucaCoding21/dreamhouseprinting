/**
 * Re-resolve every product colour's `side` image from S&S.
 *
 * The importer used to prefer `colorSideImage` over `colorDirectSideImage`, but
 * that field is inconsistent: on some styles (Gildan 18500) it holds the generic
 * style photo, a 3/4 FRONT view. The designer's Sleeve view draws its print box
 * on that image, so those products showed a sleeve print box on the chest.
 *
 * The rule here matches src/lib/ss/transform.ts: take the direct-side shot
 * ("…_d_fm.jpg") when it exists, accept `colorSideImage` only if it is really a
 * side view, otherwise store null so the designer falls back to its "no sleeve
 * photo for this colour" placeholder instead of a misleading mockup.
 *
 *   node --env-file=.env.local scripts/fix-side-images.mjs [--dry]
 */
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry");
const SS_BASE = "https://api-ca.ssactivewear.com/v2";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const auth =
  "Basic " +
  Buffer.from(`${process.env.SS_ACCOUNT}:${process.env.SS_API_KEY}`).toString("base64");

const imageUrl = (raw) =>
  raw ? `https://cdn.ssactivewear.com/${String(raw).replace(/^\/+/, "")}` : null;

const isTrueSide = (url) => !!url && /_(?:d|s)_fm\.[a-z]+$/i.test(url);

function resolveSide(row) {
  const direct = imageUrl(row.colorDirectSideImage);
  if (direct) return direct;
  const side = imageUrl(row.colorSideImage);
  return isTrueSide(side) ? side : null;
}

const { data: products, error } = await supabase
  .from("products")
  .select("id,name,ss_style_id,colours")
  .not("ss_style_id", "is", null);

if (error) throw new Error(error.message);

let changed = 0;
for (const product of products) {
  const res = await fetch(`${SS_BASE}/products/?style=${product.ss_style_id}`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) {
    console.log(`  skip ${product.name}: S&S ${res.status}`);
    continue;
  }
  const rows = await res.json();
  // One representative SKU per colour, same as the importer's transform.
  const byColour = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!byColour.has(r.colorName)) byColour.set(r.colorName, r);
  }

  let touched = 0;
  const colours = (product.colours ?? []).map((c) => {
    const row = byColour.get(c.name);
    if (!row) return c;
    const next = resolveSide(row);
    const prev = c.images?.side ?? null;
    if (next === prev) return c;
    touched += 1;
    return { ...c, images: { ...c.images, side: next } };
  });

  if (!touched) continue;
  changed += 1;
  const withSide = colours.filter((c) => c.images?.side).length;
  console.log(
    `${DRY ? "would fix" : "fixed"} ${product.name}: ${touched} colour(s) rewritten, ${withSide}/${colours.length} now have a true side photo`,
  );
  if (DRY) continue;

  const { error: upErr } = await supabase
    .from("products")
    .update({ colours })
    .eq("id", product.id);
  if (upErr) console.log(`  !! ${product.name}: ${upErr.message}`);
}

console.log(`${DRY ? "Dry run" : "Done"}: ${changed} product(s) affected.`);
