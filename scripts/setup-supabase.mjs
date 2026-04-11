// Idempotent Supabase setup:
//  1. Creates the `quote-files` storage bucket
//  2. Verifies the `submissions` table exists — and if not, prints the SQL
//     for you to paste into the Supabase SQL editor (the JS SDK cannot run
//     DDL, so this is the manual part).
//
// Run with: npm run setup

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. Did you create .env.local?",
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "quote-files";

const TABLE_SQL = `create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name text not null,
  email text not null,
  phone text not null,
  referral_code text,

  product_type text not null,
  garment_brand text,
  garment_color text not null,
  sizes jsonb,
  quantity integer,

  print_colors text not null,
  print_locations text[] not null default '{}',
  print_method text not null,

  design_description text,
  needed_by date,
  notes text,
  price_match_link text,

  artwork_files jsonb not null default '[]'::jsonb,
  price_match_files jsonb not null default '[]'::jsonb
);

alter table public.submissions enable row level security;

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);`;

async function main() {
  // 1. Storage bucket
  console.log(`→ Checking storage bucket "${BUCKET}"…`);
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error("Failed to list buckets:", listErr);
    process.exit(1);
  }
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (exists) {
    console.log(`✓ Bucket "${BUCKET}" already exists.`);
  } else {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 26214400, // 25 MB
    });
    if (createErr) {
      console.error(`Failed to create bucket "${BUCKET}":`, createErr);
      process.exit(1);
    }
    console.log(`✓ Created private bucket "${BUCKET}".`);
  }

  // 2. Submissions table — schema-check by selecting a known column
  console.log("\n→ Verifying submissions table…");
  const { error: tableErr } = await supabase
    .from("submissions")
    .select("id,name,email,phone,print_locations,artwork_files")
    .limit(1);

  if (!tableErr) {
    console.log("✓ submissions table exists and has the expected columns.");
    console.log("\nDone. You can now run `npm run dev`.");
    return;
  }

  console.log(`✗ submissions table missing or schema mismatch.`);
  console.log(`  (${tableErr.message})\n`);
  console.log(
    "The Supabase JS SDK can't run DDL, so you need to create the table manually.",
  );
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  console.log("\nCopy the SQL below and run it in the Supabase SQL editor:");
  if (ref) {
    console.log(`  → https://supabase.com/dashboard/project/${ref}/sql/new`);
  }
  console.log("\n---8<---");
  console.log(TABLE_SQL);
  console.log("--->8---\n");
  console.log(
    "After running it, re-run `npm run setup` to confirm the table is reachable.",
  );
  process.exit(2);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
