-- Drop the niche "More" categories from the shop. They never carried products
-- and the storefront no longer renders a niche section. (Seeded in 0003.)
delete from public.categories
where slug in ('quarter-zips', 'windbreakers', 'bags');
