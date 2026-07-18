-- ============================================================================
-- Interac e-Transfer as a second payment path (alongside Stripe card checkout).
--
-- payment_method: how the order was (or is being) paid. 'card' is stamped by
--   the Stripe paid path; 'etransfer' when the customer chooses e-transfer.
-- etransfer_reported_at: the customer clicked "I've sent the e-transfer".
--   The order is NOT paid at that point: admin verifies the deposit in the
--   bank and confirms in the order's Payment card, which stamps paid_at.
-- ============================================================================

alter table public.orders
  add column if not exists payment_method text
    check (payment_method in ('card', 'etransfer', 'other')),
  add column if not exists etransfer_reported_at timestamptz;

-- Customers may read both fields on their own orders (0014 revoked the blanket
-- SELECT and re-granted per column, so new customer-safe columns need their own
-- grant). Additive and harmless if 0014's revoke has not run yet.
grant select (payment_method, etransfer_reported_at) on public.orders to authenticated;

-- Customer email for the "we're watching for your transfer" confirmation.
-- Merged into the existing email_templates settings row only when absent, so
-- an admin-edited copy is never overwritten.
update public.settings
set value = value || '{
  "etransfer_reported": {
    "subject": "Got it! We''re watching for your e-transfer",
    "body": "Hi {{customerName}},\n\nThanks for sending your Interac e-Transfer of {{totalDue}} for order {{orderNumber}}. We''ll confirm it as soon as it lands (usually within 1 business day) and get your order moving right away.\n\nIf anything looks off, just reply to this email."
  }
}'::jsonb
where key = 'email_templates'
  and not (value ? 'etransfer_reported');
