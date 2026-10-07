-- When will an order be ready? Julian's rule: standard orders are ready 8-12
-- business days after the customer approves the proof AND pays, so a customer
-- who sits on the proof for a week pushes their own date back by a week. The
-- old due_date was projected from the product lead time at placement, which
-- started the count before the proof even existed.
--
-- turnaround: how the ready date is decided.
--   {"kind":"days","min":8,"max":12}  business days counted from production_clock_at
--   {"kind":"date"}                   due_date is the commitment (staff picked it)
--   {"kind":"date","requested":true}  due_date is the customer's ask, not confirmed yet
--   null                              legacy row: due_date set means "date", else the shop's standard window
-- production_clock_at: when the order became approved and paid (or went into
-- production), i.e. when the business-day count starts. Cleared if the order
-- steps back before approval. Idempotent so a re-run (dashboard paste then
-- db-push) is harmless.
alter table public.orders
  add column if not exists turnaround jsonb,
  add column if not exists production_clock_at timestamptz;

-- Customers read their own orders through per-column grants (0014), so new
-- customer-safe columns need their own.
grant select (turnaround, production_clock_at) on public.orders to authenticated;

-- Backfill open pre-approval orders. Their due_date was the placement-time
-- projection, meaningless now that the count starts at approval. Keep dates a
-- customer asked for or staff typed in by hand; move the rest to business days
-- (a rush tier keeps its own day count).
update public.orders o
set
  turnaround = case
    when coalesce((
      select (a.detail -> 'rushTier' ->> 'days')::int
      from public.order_activity a
      where a.order_id = o.id and a.type = 'order_created' and jsonb_typeof(a.detail -> 'rushTier') = 'object'
      limit 1
    ), 0) > 0
    then (
      select jsonb_build_object('kind', 'days', 'min', (a.detail -> 'rushTier' ->> 'days')::int, 'max', (a.detail -> 'rushTier' ->> 'days')::int)
      from public.order_activity a
      where a.order_id = o.id and a.type = 'order_created' and jsonb_typeof(a.detail -> 'rushTier') = 'object'
      limit 1
    )
    else jsonb_build_object('kind', 'days', 'min', 8, 'max', 12)
  end,
  due_date = null
where o.turnaround is null
  and o.production_clock_at is null
  and o.status in ('draft', 'submitted', 'in_review', 'proof_ready', 'changes_requested')
  and not exists (
    select 1 from public.order_activity a
    where a.order_id = o.id and a.type = 'order_created' and coalesce(a.detail ->> 'neededBy', '') <> ''
  )
  and not exists (
    select 1 from public.order_activity a
    where a.order_id = o.id and a.type = 'order_edited' and a.detail ->> 'message' like 'Due date set to%'
  );

-- A date the customer picked at checkout is a request until staff confirm it.
update public.orders o
set turnaround = jsonb_build_object('kind', 'date', 'requested', true)
where o.turnaround is null
  and o.due_date is not null
  and o.status in ('draft', 'submitted', 'in_review', 'proof_ready', 'changes_requested')
  and exists (
    select 1 from public.order_activity a
    where a.order_id = o.id and a.type = 'order_created' and coalesce(a.detail ->> 'neededBy', '') <> ''
  )
  and not exists (
    select 1 from public.order_activity a
    where a.order_id = o.id and a.type = 'order_edited' and a.detail ->> 'message' like 'Due date set to%'
  );
