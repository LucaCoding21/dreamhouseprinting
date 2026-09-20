-- ============================================================================
-- Seed: decoration methods (PRD §2.1 default set), the Shop-All category tree
-- (§3.3), and default settings. Idempotent via ON CONFLICT on natural keys.
-- ============================================================================

-- Decoration methods ----------------------------------------------------------
insert into public.decoration_methods (name, slug, description, setup_fee, per_unit_cost, per_color_cost, constraints, display_order) values
  ('Screen Print', 'screenprint',
   'Ink pressed through a stencil — the classic, durable choice for bold designs and bigger runs. Best value at quantity. Limited colour count per design.',
   25, 0, 3, '{"maxColors": 6}', 1),
  ('Embroidery', 'embroidery',
   'Thread stitched into the garment for a premium, textured finish that lasts. Ideal for logos on hats, polos and jackets.',
   40, 0, 0, '{"maxStitchK": 15000}', 2),
  ('DTG', 'dtg',
   'Direct-to-garment digital printing — full colour, photo-quality detail with no colour limit. Great for complex art and small runs.',
   0, 0, 0, '{}', 3),
  ('Vinyl / Heat Transfer', 'vinyl',
   'Cut vinyl heat-pressed onto the garment — crisp single-colour names, numbers and simple shapes. Perfect for team jerseys.',
   10, 0, 0, '{}', 4)
on conflict (slug) do nothing;

-- Major categories ------------------------------------------------------------
insert into public.categories (name, slug, parent_id, is_major, display_order) values
  ('Shirts',         'shirts',       null, true, 1),
  ('Hoodies',        'hoodies',      null, true, 2),
  ('Hats & Toques',  'hats-toques',  null, true, 3),
  ('Totes',          'totes',        null, true, 4)
on conflict (slug) do nothing;

-- Niche categories (sit below the divider in the sidebar) ----------------------
insert into public.categories (name, slug, parent_id, is_major, display_order) values
  ('Quarter Zips',   'quarter-zips', null, false, 10),
  ('Windbreakers',   'windbreakers', null, false, 11),
  ('Bags',           'bags',         null, false, 12)
on conflict (slug) do nothing;

-- Shirts subcategories (§3.3.1) -----------------------------------------------
insert into public.categories (name, slug, parent_id, is_major, display_order)
select v.name, v.slug, (select id from public.categories where slug = 'shirts'), false, v.ord
from (values
  ('Short Sleeve',          'shirts-short-sleeve', 1),
  ('Long Sleeve',           'shirts-long-sleeve',  2),
  ('Athletic',              'shirts-athletic',     3),
  ('Tank Tops & Sleeveless','shirts-tanks',        4),
  ('Ringer',                'shirts-ringer',       5),
  ('V-Neck',                'shirts-v-neck',       6),
  ('Ladies',                'shirts-ladies',       7),
  ('Kids',                  'shirts-kids',         8)
) as v(name, slug, ord)
on conflict (slug) do nothing;

-- Default settings ------------------------------------------------------------
insert into public.settings (key, value) values
  ('shipping', '{"options":[{"name":"Standard","cost":0,"days":"5-7"},{"name":"Express","cost":25,"days":"2-3"}],"pickupEnabled":true,"pickupLocation":"Vancouver, BC"}'),
  ('tax', '{"rate":0.12,"label":"GST + PST (BC)"}'),
  ('shop', '{"name":"Dreamhouse Printing","currency":"CAD","locale":"en-CA"}'),
  ('email_templates', '{
    "order_confirmation":{"subject":"We got your order — {{orderNumber}}","body":"Thanks {{customerName}}! Your order {{orderNumber}} is in. We''ll review your artwork and send a proof shortly."},
    "proof_ready":{"subject":"Your proof is ready — {{orderNumber}}","body":"Hi {{customerName}}, your proof for {{orderNumber}} is ready to review. Log in to approve it or request changes."},
    "changes_requested":{"subject":"Changes requested — {{orderNumber}}","body":"We received your change request for {{orderNumber}} and are on it."},
    "in_production":{"subject":"Now printing — {{orderNumber}}","body":"Good news {{customerName}} — {{orderNumber}} is approved and in production."},
    "shipped":{"subject":"On the way — {{orderNumber}}","body":"Your order {{orderNumber}} has shipped. {{trackingLine}}"},
    "ready_for_pickup":{"subject":"Ready for pickup — {{orderNumber}}","body":"{{orderNumber}} is ready for pickup in {{pickupLocation}}."}
  }')
on conflict (key) do nothing;
