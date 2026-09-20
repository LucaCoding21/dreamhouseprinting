-- Designs can carry multiple garment colourways (same artwork, different shirt
-- colours), each with its own size breakdown + per-colour pricing. Empty array =
-- a single-colour design described by the legacy colour/size_quantities columns.
alter table public.designs
  add column if not exists colorways jsonb not null default '[]'::jsonb;
