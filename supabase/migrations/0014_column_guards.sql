-- ============================================================================
-- Column-level guards (defense-in-depth over RLS)
--
-- Closes two holes where RLS alone is not enough, because RLS gates ROWS but
-- not COLUMNS or the values a user may write. Both are reachable directly
-- against PostgREST with the public anon key + a customer's session JWT, so a
-- server-side serializer that "hides" these fields is cosmetic. The fix has to
-- live in the database.
--
-- 1. profiles: privilege-escalation via self-update.
--    `profiles_update` (0002) lets a user update their own row. With no column
--    guard, any authenticated user could set role='staff_admin', grant
--    themselves staff_permissions, attach to an organization_id / org_role, or
--    write the staff-only internal_notes / saved_artwork columns. A BEFORE
--    UPDATE trigger rejects changes to those columns unless the caller is a
--    staff admin or a system/service path.
--
-- 2. orders / order_activity: staff-only data readable by the row owner.
--    A customer can read their own order rows and their orders' activity rows.
--    Without column privileges that exposes internal_notes, production_notes,
--    hold_note and sales_rep on orders, and every internal activity entry
--    (price_edit, note, ...) on order_activity. We revoke the blanket SELECT and
--    re-grant only the customer-safe columns of orders; order_activity SELECT is
--    revoked from customers entirely (the one customer surface that renders a
--    timeline now reads it with the service client after RLS has already proven
--    ownership, and emits only customer-safe activity types).
--
-- Service-role clients (createSupabaseServiceClient) BYPASS RLS but NOT triggers,
-- and they keep their table-level grants, so every admin/system path is
-- unaffected. auth.uid() is null for the service role and for direct SQL
-- (migrations, dashboard, seed scripts), which the trigger treats as trusted.
-- ============================================================================

-- 1. profiles: reject privileged-column changes from non-admin users ----------
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Trusted paths: the service role and any direct SQL (migrations, dashboard,
  -- seed scripts) have no auth.uid(); staff admins may change anything. Everyone
  -- else is a customer (or plain staff) editing their OWN row through the
  -- anon/authenticated client and must not be able to escalate.
  if auth.uid() is null or public.is_staff_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.staff_permissions is distinct from old.staff_permissions
     or new.organization_id is distinct from old.organization_id
     or new.org_role is distinct from old.org_role
     or new.internal_notes is distinct from old.internal_notes
     or new.saved_artwork is distinct from old.saved_artwork then
    raise exception
      'profiles: role, staff_permissions, organization_id, org_role, internal_notes and saved_artwork can only be changed by a staff admin'
      using errcode = '42501';
  end if;

  return new;
end; $$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- 2a. orders: hide staff-only columns from the row owner ----------------------
-- Excluded (staff-only): internal_notes, production_notes, hold_note, sales_rep.
-- All other columns (0001 base + 0008 guest_email + 0009 lifecycle) stay
-- readable so the customer portal / public order page keep working.
revoke select on public.orders from anon, authenticated;

grant select (
  id,
  order_number,
  customer_id,
  organization_id,
  status,
  payment_status,
  pricing,
  official_mockups,
  customer_notes,
  due_date,
  shipping_address,
  billing_address,
  shipping_method,
  fulfillment_method,
  shipping_tracking,
  guest_email,
  public_token,
  stripe_checkout_session_id,
  invoice_sent_at,
  invoice_amount,
  paid_at,
  created_at,
  updated_at
) on public.orders to authenticated;
-- anon is intentionally left with no SELECT: the only logged-out order surface
-- is /o/[token], which reads through the service client.

-- 2b. order_activity: not directly readable by customers ----------------------
-- Column privileges cannot filter by row TYPE, and the internal entries
-- (price_edit, note, details_updated, ...) live in the same rows a customer owns.
-- So revoke SELECT outright. The customer timeline (src/app/account/orders/[id])
-- now reads activity with the service client, gated by the RLS-scoped getMyOrder
-- ownership check above it, and the serializer only ever emits customer-safe
-- types. Staff/admin already read it through the service client. The RLS
-- order_activity_select policy (0002) is kept as defense-in-depth in case a
-- future grant is (re)added.
revoke select on public.order_activity from anon, authenticated;
