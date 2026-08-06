-- ============================================================================
-- Per-size print limits on a print area.
--
-- A print area's max_width_in x max_height_in describes the standard adult
-- size the photo shows, but the real printable area varies with garment size
-- (a Youth/XS hoodie takes a smaller print than a 3XL). size_limits holds the
-- admin-entered per-size-range overrides:
--
--   [{ "label": "Youth/XS", "maxWidthIn": 9, "maxHeightIn": 12 }, ...]
--
-- Customers keep seeing the one drawn box (the standard size); these numbers
-- surface on the admin order detail so the artist applies the right max per
-- size at proof time.
-- ============================================================================

alter table public.print_areas
  add column if not exists size_limits jsonb not null default '[]'::jsonb;
