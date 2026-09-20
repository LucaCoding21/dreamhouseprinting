#!/usr/bin/env node
/**
 * Seeds the shop catalog from live S&S Activewear (Canadian endpoint).
 *
 * For a curated list of real styles it: resolves the S&S styleID, builds a
 * normalized product draft, upserts the products row (by ss_style_id), assigns
 * a major category + subcategory, sets a sensible markup, (re)writes a default
 * front print area so the product opens cleanly in the designer, and marks it
 * active, with one featured product per major category for the storefront's
 * Top-5 row and category tiles.
 *
 * Idempotent: re-running refreshes S&S-owned fields + config + print area in
 * place (no duplicates). The existing B+C 3001 is included, so re-running also
 * resets its print area to the clean default.
 *
 * MIRRORS src/lib/ss/transform.ts (colour/size/photo normalization) and the
 * importStyleAction insert shape in src/app/admin/products/actions.ts. That
 * module is `server-only` TS and can't be imported into a plain Node script, so
 * the logic is duplicated here ON PURPOSE, if transform.ts changes its colour/
 * size/photo shape or the products insert columns change, update this too.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-catalog.mjs          # seed (writes)
 *   node --env-file=.env.local scripts/seed-catalog.mjs --dry    # resolve only
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Per-product quote curves (Julian's quick-quote prices), generated from
// src/lib/pricing.ts by scripts/gen-quote-curves.mjs. Each catalog entry's
// `curve` key (below) maps it to one of these; stamped onto pricing_rules.quote.
const QUOTE_CURVES = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "quote-curves.json"), "utf8")
);

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SS_ACCOUNT = process.env.SS_ACCOUNT;
const SS_API_KEY = process.env.SS_API_KEY;
const SS_BASE = (process.env.SS_BASE_URL ?? "https://api-ca.ssactivewear.com/v2").replace(/\/$/, "");
const SS_CDN = "https://cdn.ssactivewear.com";
const DRY = process.argv.includes("--dry");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!SS_ACCOUNT || !SS_API_KEY) {
  console.error("Missing SS_ACCOUNT / SS_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/* ----------------------------- S&S client ------------------------------ */

const ssAuth = "Basic " + Buffer.from(`${SS_ACCOUNT}:${SS_API_KEY}`).toString("base64");

async function ssGet(path, params) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${SS_BASE}${path}${qs}`, {
    headers: { Authorization: ssAuth, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`S&S ${res.status} on ${path}: ${body.slice(0, 160)}`);
  }
  return res.json();
}

function ssImageUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${SS_CDN}/${path.replace(/^\//, "")}`;
}

const ssSearchStyles = (query) => ssGet("/styles/", { search: query });
async function ssGetStyle(styleId) {
  const data = await ssGet(`/styles/${styleId}`);
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}
const ssGetProducts = (styleId) => ssGet("/products/", { style: String(styleId) });

/* --------------------- transform.ts (mirrored) -------------------------- */

function cleanDescription(html) {
  if (!html) return "";
  return html
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function coloursFromProducts(products) {
  const byColour = new Map();
  for (const p of products) {
    const list = byColour.get(p.colorName) ?? [];
    list.push(p);
    byColour.set(p.colorName, list);
  }
  const colours = [];
  for (const [name, skus] of byColour) {
    const rep = skus[0];
    const inStock = skus.some((s) => s.qty > 0);
    colours.push({
      name,
      hex: rep.color1 || "#cccccc",
      swatch: ssImageUrl(rep.colorSwatchImage),
      ssColorCode: rep.colorCode,
      inStock,
      images: {
        front: ssImageUrl(rep.colorFrontImage),
        back: ssImageUrl(rep.colorBackImage),
        side: ssImageUrl(rep.colorSideImage || rep.colorDirectSideImage),
        model: ssImageUrl(rep.colorOnModelFrontImage),
      },
    });
  }
  return colours;
}

function sizesFromProducts(products) {
  const bySize = new Map();
  for (const p of products) {
    const existing = bySize.get(p.sizeName);
    const inStock = p.qty > 0;
    if (existing) existing.inStock = existing.inStock || inStock;
    else bySize.set(p.sizeName, { name: p.sizeName, ssSizeCode: p.sizeCode, order: p.sizeOrder, inStock });
  }
  return [...bySize.values()].sort((a, b) => a.order.localeCompare(b.order));
}

function baseWholesaleCost(products) {
  const prices = products.map((p) => p.customerPrice).filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : 0;
}

function buildPhotos(style, colours) {
  const photos = [];
  const styleImg = ssImageUrl(style.styleImage);
  if (styleImg) photos.push({ src: styleImg, type: "style" });
  for (const c of colours.slice(0, 6)) {
    if (c.images.front) photos.push({ src: c.images.front, type: "flat", colorName: c.name, view: "front" });
  }
  return photos;
}

async function buildProductDraft(styleId) {
  const [style, products] = await Promise.all([ssGetStyle(styleId), ssGetProducts(styleId)]);
  if (!style) throw new Error(`S&S style ${styleId} not found`);
  const colours = coloursFromProducts(products);
  const sizes = sizesFromProducts(products);
  const anyStock = colours.some((c) => c.inStock);
  return {
    ssStyleId: String(style.styleID),
    ssPartNumber: style.partNumber,
    ssStyleName: style.styleName,
    brand: style.brandName,
    name: style.title || style.styleName,
    description: cleanDescription(style.description),
    photos: buildPhotos(style, colours),
    colours,
    sizes,
    wholesaleCost: baseWholesaleCost(products),
    stockStatus: anyStock ? "in_stock" : "out_of_stock",
  };
}

/* ------------------------- curated catalog ------------------------------ */

// Default print areas per product family (normalized 0..1 on the matching view
// image). Apparel gets a front AND a back so the designer shows both sides at
// once; caps are front-only (no back print).
//
// The position envelope's PIXEL aspect must match maxWidthIn:maxHeightIn so
// inch measurements are uniform on both axes. S&S CDN colour images are all
// 500×625 (aspect A = 0.8), so:  height = width × A × maxHeightIn / maxWidthIn.
// (The designer aspect-corrects at runtime anyway, lib/design/printArea, so a
// drifted box degrades gracefully; these defaults start out exact.) Widths are
// calibrated to the garment's real-world scale in the S&S photos so a 12″ print
// looks 12″ on the mockup.
const PRINT_AREA = {
  shirts: {
    // ~22″ garment across ~0.80 of the frame → 1″ ≈ 0.036 of image width.
    front: { name: "Front center", position: { x: 0.28, y: 0.24, width: 0.44, height: 0.41 }, maxWidthIn: 12, maxHeightIn: 14 },
    back: { name: "Full back", position: { x: 0.245, y: 0.18, width: 0.51, height: 0.47 }, maxWidthIn: 14, maxHeightIn: 16 },
  },
  hoodies: {
    // Bulkier garment, wider in frame; front print sits above the pouch pocket.
    front: { name: "Front center", position: { x: 0.29, y: 0.3, width: 0.42, height: 0.34 }, maxWidthIn: 12, maxHeightIn: 12 },
    back: { name: "Full back", position: { x: 0.29, y: 0.17, width: 0.42, height: 0.45 }, maxWidthIn: 12, maxHeightIn: 16 },
  },
  "hats-toques": {
    // Embroidery on the front panel.
    front: { name: "Front", position: { x: 0.345, y: 0.33, width: 0.31, height: 0.14 }, maxWidthIn: 4.5, maxHeightIn: 2.5 },
  },
  totes: {
    front: { name: "Front center", position: { x: 0.265, y: 0.28, width: 0.47, height: 0.45 }, maxWidthIn: 10, maxHeightIn: 12 },
    back: { name: "Back center", position: { x: 0.265, y: 0.28, width: 0.47, height: 0.45 }, maxWidthIn: 10, maxHeightIn: 12 },
  },
};

// q = S&S free-text search; match = exact styleName to pick out of results;
// brand = substring (normalized) the result's brandName must contain.
// `curve` maps the product to a quote curve in quote-curves.json so the
// storefront Detailed Quote prices it against Julian's real quick-quote numbers.
const CATALOG = [
  // Shirts → tee curve
  { q: "Bella Canvas 3001", brand: "bella", match: "3001", category: "shirts", subcategory: "shirts-short-sleeve", featured: true, curve: "t-shirts" },
  { q: "Gildan 5000", brand: "gildan", match: "5000", category: "shirts", subcategory: "shirts-short-sleeve", curve: "t-shirts" },
  { q: "Next Level 6210", brand: "next", match: "6210", category: "shirts", subcategory: "shirts-short-sleeve", curve: "t-shirts" },
  { q: "Comfort Colors 1717", brand: "comfort", match: "1717", category: "shirts", subcategory: "shirts-short-sleeve", curve: "t-shirts" },
  // Hoodies (18000 is a crewneck → crewneck curve)
  { q: "Gildan 18500", brand: "gildan", match: "18500", category: "hoodies", featured: true, curve: "hoodies" },
  { q: "Independent Trading SS4500", brand: "independent", match: "SS4500", category: "hoodies", curve: "hoodies" },
  { q: "Gildan 18000", brand: "gildan", match: "18000", category: "hoodies", curve: "crewnecks" },
  // Hats & Toques (Yupoong 6245CM / Liberty 8860 aren't on the CA endpoint; the
  // YP Classics 6245PT dad hat is the in-catalogue Yupoong equivalent.) Caps →
  // dad-cap curve, beanie → toque curve.
  { q: "YP Classics 6245PT", brand: "yp", match: "6245PT", category: "hats-toques", featured: true, curve: "dad-cap" },
  { q: "Sportsman SP12", brand: "sportsman", match: "SP12", category: "hats-toques", curve: "toque" },
  { q: "Flexfit 6277", brand: "flexfit", match: "6277", category: "hats-toques", curve: "dad-cap" },
  { q: "Richardson 112", brand: "richardson", match: "112", category: "hats-toques", curve: "dad-cap" },
  // Totes → tote curve
  { q: "Q-Tees Q1300", brand: "q-tees", match: "Q1300", category: "totes", featured: true, curve: "tote-bags" },
  { q: "Q-Tees Q1500", brand: "q-tees", match: "Q1500", category: "totes", curve: "tote-bags" },
  { q: "Q-Tees Q4500", brand: "q-tees", match: "Q4500", category: "totes", curve: "tote-bags" },
];

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function resolveStyle(entry) {
  const styles = await ssSearchStyles(entry.q);
  const list = Array.isArray(styles) ? styles : [];
  const wantBrand = norm(entry.brand);
  const wantStyle = norm(entry.match);
  // Prefer exact styleName + brand contains; fall back to styleName startsWith.
  let hit = list.find((s) => norm(s.styleName) === wantStyle && norm(s.brandName).includes(wantBrand));
  if (!hit) hit = list.find((s) => norm(s.styleName) === wantStyle);
  if (!hit) hit = list.find((s) => norm(s.styleName).startsWith(wantStyle) && norm(s.brandName).includes(wantBrand));
  return hit ?? null;
}

/* ------------------------------- run ------------------------------------ */

async function main() {
  // Category slug → id.
  const { data: cats, error: catErr } = await supabase.from("categories").select("id, slug");
  if (catErr) throw catErr;
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  // All active decoration methods (default allowed set).
  const { data: methods } = await supabase.from("decoration_methods").select("id").eq("is_active", true);
  const allowedMethods = (methods ?? []).map((m) => m.id);

  let ok = 0;
  for (const entry of CATALOG) {
    const tag = `${entry.q}`;
    try {
      const style = await resolveStyle(entry);
      if (!style) {
        console.log(`✗ UNRESOLVED  ${tag}`);
        continue;
      }
      const resolvedLabel = `${style.brandName} ${style.styleName} (#${style.styleID}) "${style.title}", ${style.baseCategory}`;
      if (DRY) {
        console.log(`• ${tag.padEnd(24)} → ${resolvedLabel}`);
        ok++;
        continue;
      }

      const draft = await buildProductDraft(style.styleID);

      const row = {
        ss_style_id: draft.ssStyleId,
        ss_part_number: draft.ssPartNumber,
        ss_style_name: draft.ssStyleName,
        ss_last_synced_at: new Date().toISOString(),
        brand: draft.brand,
        name: draft.name,
        description: draft.description,
        photos: draft.photos,
        colours: draft.colours,
        sizes: draft.sizes,
        wholesale_cost: draft.wholesaleCost,
        stock_status: draft.stockStatus,
        category_id: catId.get(entry.category) ?? null,
        subcategory_id: entry.subcategory ? catId.get(entry.subcategory) ?? null : null,
        markup_type: "percent",
        markup_value: 100,
        allowed_decoration_method_ids: allowedMethods,
        lead_time_days: 7,
        is_active: true,
        is_featured: !!entry.featured,
      };

      // Upsert by ss_style_id (unique). Insert new or patch existing in place.
      const { data: existing } = await supabase
        .from("products")
        .select("id, pricing_rules")
        .eq("ss_style_id", draft.ssStyleId)
        .maybeSingle();

      // Stamp the storefront quote curve, preserving any other pricing_rules
      // keys (e.g. admin-set bulkTiers) already on the row.
      const curve = entry.curve ? QUOTE_CURVES[entry.curve] : null;
      if (!curve && entry.curve) console.log(`  ! no curve "${entry.curve}" in quote-curves.json`);
      row.pricing_rules = { ...(existing?.pricing_rules ?? {}), ...(curve ? { quote: curve } : {}) };

      let productId;
      if (existing) {
        const { error } = await supabase.from("products").update(row).eq("id", existing.id);
        if (error) throw error;
        productId = existing.id;
      } else {
        const { data, error } = await supabase.from("products").insert(row).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      // (Re)write the default print areas (front + back for apparel) so the
      // product opens cleanly in the designer with both sides editable.
      const fam = PRINT_AREA[entry.category] ?? PRINT_AREA.shirts;
      await supabase.from("print_areas").delete().eq("product_id", productId);
      const areas = ["front", "back"]
        .filter((view) => fam[view])
        .map((view, i) => ({
          product_id: productId,
          name: fam[view].name,
          view,
          position: fam[view].position,
          max_width_in: fam[view].maxWidthIn,
          max_height_in: fam[view].maxHeightIn,
          px_per_inch: 0,
          display_order: i,
        }));
      const { error: paErr } = await supabase.from("print_areas").insert(areas);
      if (paErr) throw paErr;

      console.log(
        `✓ ${existing ? "updated" : "created"}  ${resolvedLabel}  [${draft.colours.length} colours, ${draft.sizes.length} sizes]${entry.featured ? " ★featured" : ""}`
      );
      ok++;
    } catch (e) {
      console.log(`✗ FAILED      ${tag}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\n${DRY ? "Resolved" : "Seeded"} ${ok}/${CATALOG.length} styles.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
