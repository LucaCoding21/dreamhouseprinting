-- Order lifecycle completion: public tokenized order link, Stripe invoicing,
-- per-item proofs, and the three static production note fields from the
-- admin order-detail redesign (customer / inventory / printer).
--
-- public_token grants read + proof-decision + pay on one order via /o/{token}.
-- It is a 256-bit random value; the page is noindex and the token only ever
-- travels in emails to the order's own recipient.

create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists public_token text,
  add column if not exists production_notes jsonb not null default '{}'::jsonb,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists invoice_sent_at timestamptz,
  add column if not exists invoice_amount numeric,
  add column if not exists paid_at timestamptz;

-- 32 random bytes -> base64url without padding ('=' is dropped by translate).
alter table public.orders
  alter column public_token
  set default translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');

update public.orders
  set public_token = translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_')
  where public_token is null;

alter table public.orders alter column public_token set not null;

create unique index if not exists orders_public_token_key
  on public.orders (public_token);

-- Proofs can now target a single line item (order-level proofs keep null).
alter table public.proofs
  add column if not exists line_item_id uuid references public.line_items(id) on delete set null;

-- New email templates. '{new}' || value keeps any keys Julian already edited.
update public.settings
  set value = '{
    "invoice_sent": {
      "subject": "Invoice for your order {{orderNumber}}",
      "body": "Hi {{customerName}},\n\nYour invoice for order {{orderNumber}} is ready, total due {{totalDue}}.\n\nOpen your order page to review everything and pay securely online."
    },
    "payment_received": {
      "subject": "Payment received, {{orderNumber}}",
      "body": "Thanks {{customerName}}!\n\nWe received your payment of {{totalDue}} for order {{orderNumber}}. We''ll get printing and keep you posted."
    }
  }'::jsonb || value
  where key = 'email_templates';
