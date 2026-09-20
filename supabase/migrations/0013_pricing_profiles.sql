-- Shared decoration pricing profiles.
--
-- Replaces the per-product 48-cell price table with a component model:
--   product price(qty) = blank retail (wholesale x markup, per product)
--                      + decoration adder(qty)  (shared, from a profile)
--
-- A profile holds the validated all-inclusive tier prices for ONE reference
-- blank (ref_wholesale). Any product pointing at the profile compiles its own
-- curve by shifting those tiers by its blank-cost gap vs the reference. So the
-- decoration economics are authored once and reused; only the blank differs
-- between two products in the same family. The compiled curve is still written
-- to products.pricing_rules.quote, so every storefront/designer/order surface
-- keeps reading exactly what it does today.
--
-- setup: informational one-time fee per decoration (digitizing / screens). It's
-- already amortized into `tiers` today; stored separately so invoices can
-- itemize it later without a data migration.

create table if not exists public.pricing_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null,
  slug text not null unique,

  decorations text[] not null default '{}',   -- ['screen','embroidery']
  ref_wholesale numeric,                       -- blank wholesale the tiers assume
  setup jsonb not null default '{}'::jsonb,    -- { screen?: number, embroidery?: number }
  tiers jsonb not null default '{}'::jsonb,    -- { screen: [{minQty,price}], embroidery: [...] }

  is_active boolean not null default true
);

alter table public.pricing_profiles enable row level security;

-- Anyone may read active profiles (the storefront never needs them, but keeping
-- read open is harmless and simplifies previews); staff manage everything.
create policy pricing_profiles_select on public.pricing_profiles for select
  using (is_active or public.is_staff());
create policy pricing_profiles_write on public.pricing_profiles for all
  using (public.is_staff()) with check (public.is_staff());
