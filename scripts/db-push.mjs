#!/usr/bin/env node
/**
 * db-push, applies SQL migration files to the Dreamhouse Supabase project via
 * the Supabase Management API (https://api.supabase.com/v1/projects/{ref}/database/query).
 *
 * Why the Management API and not the supabase-js SDK or the MCP:
 *  - The SDK (PostgREST) cannot run DDL.
 *  - The Supabase MCP in this workspace is bound to a DIFFERENT project. Using it
 *    for writes would mutate an unrelated production database. So we target the
 *    Dreamhouse project explicitly by ref here.
 *
 * Reads SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF from the environment
 * (load with `node --env-file=.env.local`). Applies every supabase/migrations/*.sql
 * in filename order, skipping ones already recorded in public._app_migrations.
 * Each migration runs inside a transaction; a failure aborts that file and stops.
 *
 * Usage:
 *   node --env-file=.env.local scripts/db-push.mjs           # apply pending
 *   node --env-file=.env.local scripts/db-push.mjs --status  # list state only
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF. Run with: node --env-file=.env.local scripts/db-push.mjs");
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function runSql(query) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch {}
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return text ? JSON.parse(text) : null;
}

async function ensureBookkeeping() {
  await runSql(`create table if not exists public._app_migrations (
    name text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  );`);
}

async function appliedSet() {
  const rows = await runSql(`select name, checksum from public._app_migrations order by name`);
  return new Map(rows.map((r) => [r.name, r.checksum]));
}

function sha(s) {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

const statusOnly = process.argv.includes("--status");

await ensureBookkeeping();
const applied = await appliedSet();

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
if (files.length === 0) {
  console.log("No migration files found in supabase/migrations/");
  process.exit(0);
}

console.log(`Project ${REF}, ${files.length} migration file(s)\n`);

let appliedCount = 0;
for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  const checksum = sha(sql);
  const prior = applied.get(file);

  if (prior && prior === checksum) {
    console.log(`  ok    ${file} (already applied)`);
    continue;
  }
  if (prior && prior !== checksum) {
    console.error(`  DRIFT ${file}: checksum changed since it was applied (${prior} -> ${checksum}).`);
    console.error(`        Migrations are immutable. Add a new migration instead of editing this one.`);
    process.exit(1);
  }
  if (statusOnly) {
    console.log(`  PEND  ${file} (not yet applied)`);
    continue;
  }

  process.stdout.write(`  apply ${file} ... `);
  try {
    await runSql(`begin;\n${sql}\ncommit;`);
    await runSql(
      `insert into public._app_migrations (name, checksum) values ('${file}', '${checksum}')
       on conflict (name) do update set checksum = excluded.checksum, applied_at = now();`
    );
    console.log("done");
    appliedCount++;
  } catch (err) {
    console.log("FAILED");
    console.error(`\n${err.message}\n`);
    // Best-effort rollback in case the endpoint left an open txn (it won't, but be safe).
    try { await runSql("rollback;"); } catch {}
    process.exit(1);
  }
}

console.log(`\n${statusOnly ? "Status check complete." : `Applied ${appliedCount} migration(s).`}`);
