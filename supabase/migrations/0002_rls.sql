-- ============================================================================
-- Row-Level Security (PRD §1, §10.4)
--
-- Model:
--  - Storefront catalog (categories, decoration_methods, products, print_areas)
--    is world-readable but only for ACTIVE rows, deactivating in Admin hides it
--    everywhere with no code change (§10.4).
--  - Customers see only their own designs/orders/quotes (or their org's).
--  - Staff get broad read/write via is_staff().
--  - Admin mutations also run server-side with the service-role key (bypasses
--    RLS) behind explicit permission checks, RLS here is defense-in-depth.
--
-- Helper functions are SECURITY DEFINER so they read profiles without tripping
-- RLS recursion.
-- ============================================================================

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff','staff_admin')
  );
$$;

create or replace function public.is_staff_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'staff_admin'
  );
$$;

-- Staff admins implicitly hold every permission; staff hold the flags granted.
create or replace function public.has_perm(flag text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'staff_admin' or (role = 'staff' and flag = any(staff_permissions)))
  );
$$;

create or replace function public.my_org()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.can_see_order(oid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.id = oid
      and (o.customer_id = auth.uid()
        or (o.organization_id is not null and o.organization_id = public.my_org())
        or public.is_staff())
  );
$$;

-- Enable RLS everywhere -------------------------------------------------------
alter table public.organizations     enable row level security;
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.decoration_methods enable row level security;
alter table public.products          enable row level security;
alter table public.print_areas       enable row level security;
alter table public.designs           enable row level security;
alter table public.orders            enable row level security;
alter table public.line_items        enable row level security;
alter table public.proofs            enable row level security;
alter table public.order_activity    enable row level security;
alter table public.quotes            enable row level security;
alter table public.settings          enable row level security;

-- profiles --------------------------------------------------------------------
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_staff())
  with check (id = auth.uid() or public.is_staff());

-- organizations ---------------------------------------------------------------
create policy orgs_select on public.organizations for select
  using (id = public.my_org() or public.is_staff());
create policy orgs_update on public.organizations for update
  using (public.is_staff()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.organization_id = organizations.id and p.org_role = 'admin'));

-- categories (public read; staff write) --------------------------------------
create policy categories_select on public.categories for select using (true);
create policy categories_write on public.categories for all
  using (public.is_staff()) with check (public.is_staff());

-- decoration_methods (public read active; staff full) -------------------------
create policy decmethods_select on public.decoration_methods for select
  using (is_active or public.is_staff());
create policy decmethods_write on public.decoration_methods for all
  using (public.is_staff()) with check (public.is_staff());

-- products (public read active; staff full) -----------------------------------
create policy products_select on public.products for select
  using (is_active or public.is_staff());
create policy products_write on public.products for all
  using (public.is_staff()) with check (public.is_staff());

-- print_areas (public read for active product; staff full) --------------------
create policy print_areas_select on public.print_areas for select
  using (public.is_staff() or exists (
    select 1 from public.products p where p.id = print_areas.product_id and p.is_active));
create policy print_areas_write on public.print_areas for all
  using (public.is_staff()) with check (public.is_staff());

-- designs ---------------------------------------------------------------------
create policy designs_select on public.designs for select
  using (customer_id = auth.uid()
    or (organization_id is not null and organization_id = public.my_org())
    or public.is_staff());
create policy designs_insert on public.designs for insert
  with check (customer_id = auth.uid() or public.is_staff());
create policy designs_update on public.designs for update
  using (customer_id = auth.uid() or public.is_staff())
  with check (customer_id = auth.uid() or public.is_staff());
create policy designs_delete on public.designs for delete
  using (customer_id = auth.uid() or public.is_staff());

-- orders ----------------------------------------------------------------------
create policy orders_select on public.orders for select
  using (customer_id = auth.uid()
    or (organization_id is not null and organization_id = public.my_org())
    or public.is_staff());
create policy orders_insert on public.orders for insert
  with check (customer_id = auth.uid() or public.is_staff());
create policy orders_update on public.orders for update
  using (public.is_staff()) with check (public.is_staff());

-- line_items / proofs / order_activity (scoped to a visible order) ------------
create policy line_items_select on public.line_items for select
  using (public.can_see_order(order_id));
create policy line_items_write on public.line_items for all
  using (public.is_staff()) with check (public.is_staff());

create policy proofs_select on public.proofs for select
  using (public.can_see_order(order_id));
create policy proofs_write on public.proofs for all
  using (public.is_staff()) with check (public.is_staff());

create policy order_activity_select on public.order_activity for select
  using (public.can_see_order(order_id));
create policy order_activity_write on public.order_activity for all
  using (public.is_staff()) with check (public.is_staff());

-- quotes ----------------------------------------------------------------------
create policy quotes_select on public.quotes for select
  using (customer_id = auth.uid()
    or (organization_id is not null and organization_id = public.my_org())
    or public.is_staff());
create policy quotes_insert on public.quotes for insert
  with check (customer_id = auth.uid() or public.is_staff());
create policy quotes_update on public.quotes for update
  using (public.is_staff()) with check (public.is_staff());

-- settings (staff only) -------------------------------------------------------
create policy settings_all on public.settings for all
  using (public.is_staff()) with check (public.is_staff());
