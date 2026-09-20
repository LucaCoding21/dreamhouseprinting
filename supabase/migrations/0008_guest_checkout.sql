-- Guest checkout: a logged-out customer can save a design and check out with just
-- an email (no account). The browser is identified by a cookie token stored on
-- the design; guest contact details live on the design (no profile exists), and
-- guest orders carry the email directly. customer_id stays null for guests.
alter table public.designs
  add column if not exists guest_token   text,
  add column if not exists guest_contact jsonb;

create index if not exists designs_guest_token_idx on public.designs (guest_token);

alter table public.orders
  add column if not exists guest_email text;
