-- ============================================================================
-- Storage buckets. All private; the app mints short-lived signed URLs server-
-- side (matches the existing quote-files pattern, see /api/upload-url). The
-- legacy `quote-files` bucket is left as-is.
--
--  artwork , customer source uploads (full quality, retained) + org shared logos
--  designs , designer mockup renders + serialized scene assets
--  proofs  , staff official mockups & print-ready proof files
--  catalog , any shop-cached product imagery (S&S images are normally hotlinked
--             from their CDN, but this exists for overrides / manual products)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('artwork', 'artwork', false, 52428800),   -- 50MB (vector/PDF source can be large)
  ('designs', 'designs', false, 26214400),   -- 25MB
  ('proofs',  'proofs',  false, 52428800),   -- 50MB
  ('catalog', 'catalog', false, 26214400)    -- 25MB
on conflict (id) do nothing;
