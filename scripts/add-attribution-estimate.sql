-- Additive, idempotent migration — safe to run on the live table.
-- Adds: marketing attribution ("how did you find us") + the auto-estimate
-- snapshot shown to the customer. `ADD COLUMN IF NOT EXISTS` means re-running
-- is a no-op and existing rows are untouched (new columns are NULL for them).
--
-- Run in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/vnymgxztalayouvxxuzl/sql/new

alter table public.submissions
  add column if not exists heard_about        text,
  add column if not exists estimated_per_unit  numeric,
  add column if not exists estimated_total     numeric,
  add column if not exists quote_estimate      jsonb;
