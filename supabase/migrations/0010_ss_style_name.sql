-- The human-recognizable S&S style number (e.g. "5000", "18500", "6245PT"),
-- what Julian actually orders a blank by. ss_style_id is S&S's internal numeric
-- id and ss_part_number is a SKU-level code; neither is the style number a
-- printer knows the garment as. Captured at import; backfilled for existing rows.
alter table public.products add column if not exists ss_style_name text;
