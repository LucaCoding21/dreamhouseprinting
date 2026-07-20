-- ============================================================================
-- Dreamhouse Printing — platform data model (PRD §9, canonical)
-- One shared model behind all four surfaces: storefront, designer, customer
-- portal, admin. Status fields use text + CHECK (not pg enums) so the canonical
-- sets can evolve without ALTER TYPE migrations. Decoration methods are records
-- (a table), never hard-coded strings (PRD §2.1).
--
-- The existing `submissions` table (quick-quote form) is intentionally left
-- untouched; it predates this model and continues to feed Julian's inbox.
-- ============================================================================

-- updated_at helper -----------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ============================================================================
-- IDENTITY: organizations + profiles (extends auth.users)
-- ============================================================================
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  shared_artwork jsonb not null default '[]'::jsonb,   -- [{name, path, url}]
  brand_kit     jsonb not null default '{}'::jsonb,    -- {colours:[], logo:{...}}
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();

-- One row per auth user. role drives surface access; staff_permissions is the
-- §1 granular flag set (only meaningful when role in staff/staff_admin).
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  name          text,
  phone         text,
  role          text not null default 'customer'
                  check (role in ('customer','staff','staff_admin')),
  staff_permissions text[] not null default '{}',
  organization_id uuid references public.organizations(id) on delete set null,
  org_role      text check (org_role in ('admin','member')),
  addresses     jsonb not null default '[]'::jsonb,       -- [{label,name,street,city,prov,postal,country}]
  payment_methods jsonb not null default '[]'::jsonb,     -- manual labels only (payments are offline)
  saved_artwork jsonb not null default '[]'::jsonb,       -- logos/artwork on file [{name,path,url}]
  notification_preferences jsonb not null default '{}'::jsonb,
  internal_notes jsonb not null default '[]'::jsonb,      -- staff-only notes about this customer
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists profiles_org_idx on public.profiles(organization_id);
create index if not exists profiles_role_idx on public.profiles(role);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile row when an auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- CATALOG: categories, decoration_methods, products, print_areas
-- ============================================================================
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  parent_id     uuid references public.categories(id) on delete set null,
  is_major      boolean not null default true,   -- major category vs. niche item
  display_order int not null default 0,
  image         text,                              -- tile image url
  created_at    timestamptz not null default now()
);
create index if not exists categories_parent_idx on public.categories(parent_id);

create table if not exists public.decoration_methods (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  description   text,                              -- customer-facing explainer
  setup_fee     numeric not null default 0,
  per_unit_cost numeric not null default 0,
  per_color_cost numeric not null default 0,       -- where relevant (screenprint)
  constraints   jsonb not null default '{}'::jsonb, -- e.g. {maxColors: 6}
  is_active     boolean not null default true,
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger decoration_methods_touch before update on public.decoration_methods
  for each row execute function public.touch_updated_at();

-- Product = an S&S style adopted into the shop, plus Admin-owned config (§2.6).
-- S&S-owned fields (name, description, photos, colours, sizes, wholesale_cost,
-- stock) are refreshed by sync; Admin-owned fields are preserved across syncs.
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  -- S&S identity (null when hand-authored)
  ss_style_id   text,
  ss_part_number text,
  ss_last_synced_at timestamptz,
  brand         text,
  -- S&S-owned (synced)
  name          text not null,
  description   text,
  photos        jsonb not null default '[]'::jsonb,   -- [{src,type,colorName,view}]
  wholesale_cost numeric,                              -- NEVER shown to customers
  colours       jsonb not null default '[]'::jsonb,    -- [{name,hex,swatch,ssColorCode,inStock,images:{front,back,...}}]
  sizes         jsonb not null default '[]'::jsonb,    -- [{name,ssSizeCode,inStock}]
  -- Admin-owned (preserved across sync)
  category_id   uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.categories(id) on delete set null,
  base_price    numeric,
  markup_type   text not null default 'percent' check (markup_type in ('percent','flat')),
  markup_value  numeric not null default 0,
  pricing_rules jsonb not null default '{}'::jsonb,    -- size/qty adjustments, bulk tiers
  allowed_decoration_method_ids uuid[] not null default '{}',
  lead_time_days int not null default 7,
  stock_status  text not null default 'in_stock'
                  check (stock_status in ('in_stock','out_of_stock','made_to_order')),
  is_active     boolean not null default true,         -- inactive = hidden everywhere
  is_featured   boolean not null default false,        -- home page / top-5 per category
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists products_ss_style_idx on public.products(ss_style_id) where ss_style_id is not null;
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_active_idx on public.products(is_active);
create index if not exists products_featured_idx on public.products(is_featured) where is_featured;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- Admin-authored decorating zones, anchored to the S&S image coordinate space.
create table if not exists public.print_areas (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  name          text not null,                          -- front center, left chest, full back
  view          text not null default 'front'
                  check (view in ('front','back','left_sleeve','right_sleeve','sleeve')),
  position      jsonb not null,                         -- {x,y,width,height} in S&S view-image coords
  max_width_in  numeric,                                -- printable bounds, real-world inches
  max_height_in numeric,
  px_per_inch   numeric,                                -- scale inches -> canvas px for this view
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists print_areas_product_idx on public.print_areas(product_id);

-- ============================================================================
-- DESIGNS (designer tool submit payload, §4.5)
-- ============================================================================
create table if not exists public.designs (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references public.products(id) on delete set null,
  customer_id   uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  scene_definition jsonb,                               -- serialized Fabric.js JSON (re-editable)
  mockup_images jsonb not null default '[]'::jsonb,     -- [{view,url}] rendered previews
  source_artwork_files jsonb not null default '[]'::jsonb, -- [{name,path,url}] originals, full quality
  colour        jsonb,                                  -- selected garment colour object
  size_quantities jsonb not null default '{}'::jsonb,   -- {M:5,L:3}
  decoration_method_id uuid references public.decoration_methods(id) on delete set null,
  print_area_ids uuid[] not null default '{}',
  price_snapshot jsonb,                                 -- line totals + fees at submit
  status        text not null default 'draft' check (status in ('draft','submitted')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists designs_customer_idx on public.designs(customer_id);
create index if not exists designs_product_idx on public.designs(product_id);
create trigger designs_touch before update on public.designs
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- ORDERS + line items + proofs + activity (PRD §9.6–9.8, §2.4/2.5 state machines)
-- ============================================================================
create sequence if not exists public.order_number_seq;

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text unique,                            -- DH-2026-0001 (set by trigger)
  customer_id   uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  status        text not null default 'submitted'
                  check (status in ('draft','submitted','in_review','proof_ready',
                    'changes_requested','approved','in_production','quality_check',
                    'shipped','ready_for_pickup','completed','on_hold','cancelled')),
  payment_status text not null default 'unpaid'
                  check (payment_status in ('unpaid','deposit_paid','paid_in_full',
                    'refunded','partially_refunded')),
  pricing       jsonb not null default '{}'::jsonb,     -- {subtotal,setupFees,shipping,tax,discount,total}
  official_mockups jsonb not null default '[]'::jsonb,  -- staff-uploaded [{view,url}]
  internal_notes jsonb not null default '[]'::jsonb,    -- staff-only [{at,actor,text}]
  customer_notes jsonb not null default '[]'::jsonb,    -- customer-facing [{at,actor,text}]
  due_date      date,                                   -- derived from product lead times
  shipping_address jsonb,
  billing_address jsonb,
  shipping_method text,                                 -- standard/express
  fulfillment_method text default 'ship' check (fulfillment_method in ('ship','pickup')),
  shipping_tracking text,
  sales_rep     text,
  hold_note     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders(customer_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_idx on public.orders(created_at desc);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Assign DH-{year}-{padded} on insert.
create or replace function public.assign_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := 'DH-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.order_number_seq')::text, 4, '0');
  end if;
  return new;
end; $$;
drop trigger if exists orders_assign_number on public.orders;
create trigger orders_assign_number before insert on public.orders
  for each row execute function public.assign_order_number();

create table if not exists public.line_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  design_id     uuid references public.designs(id) on delete set null,
  product_name  text,                                   -- snapshot for display
  colour        jsonb,
  size_quantities jsonb not null default '{}'::jsonb,
  decoration_method_id uuid references public.decoration_methods(id) on delete set null,
  decorations   jsonb not null default '[]'::jsonb,     -- [{location,type,width,height,colours[]}] (admin spots)
  unit_price    numeric not null default 0,
  setup_fee     numeric not null default 0,
  line_total    numeric not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists line_items_order_idx on public.line_items(order_id);

create table if not exists public.proofs (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  image         text not null,                          -- mockup url sent to customer
  status        text not null default 'pending'
                  check (status in ('pending','approved','changes_requested')),
  change_request_comment text,
  decoration_files jsonb not null default '[]'::jsonb,  -- print-ready, per method [{method,name,path,url}]
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists proofs_order_idx on public.proofs(order_id);

-- Auditable activity log (PRD §10.6). Append-only; actor + timestamp.
create table if not exists public.order_activity (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  actor_id      uuid references public.profiles(id) on delete set null,
  actor_name    text,
  type          text not null,                          -- status_change, price_edit, proof_uploaded, note, payment, ...
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists order_activity_order_idx on public.order_activity(order_id, created_at desc);

-- ============================================================================
-- QUOTES (PRD §9.11)
-- ============================================================================
create sequence if not exists public.quote_number_seq;
create table if not exists public.quotes (
  id            uuid primary key default gen_random_uuid(),
  quote_number  text unique,
  customer_id   uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  line_items    jsonb not null default '[]'::jsonb,     -- staff-built lines with bulk-tier pricing
  design_ids    uuid[] not null default '{}',
  pricing       jsonb not null default '{}'::jsonb,     -- bulk-tier pricing snapshot
  contact       jsonb not null default '{}'::jsonb,     -- {name,email,phone} for guest requests
  message       text,
  status        text not null default 'requested'
                  check (status in ('requested','sent','accepted','declined','converted')),
  converted_order_id uuid references public.orders(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists quotes_status_idx on public.quotes(status);
create trigger quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();

create or replace function public.assign_quote_number()
returns trigger language plpgsql as $$
begin
  if new.quote_number is null then
    new.quote_number := 'QT-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.quote_number_seq')::text, 4, '0');
  end if;
  return new;
end; $$;
drop trigger if exists quotes_assign_number on public.quotes;
create trigger quotes_assign_number before insert on public.quotes
  for each row execute function public.assign_quote_number();

-- ============================================================================
-- SETTINGS (singleton-ish key/value: shipping, tax, email templates, §9.13)
-- ============================================================================
create table if not exists public.settings (
  key           text primary key,
  value         jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();
