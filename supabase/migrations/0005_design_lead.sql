-- Designs gain a customer-given name + a lead email, both captured by the
-- "Save your design" modal that gates the checkout funnel. The name powers
-- "My Designs"; the lead email lets us follow up even if checkout is abandoned.
alter table public.designs
  add column if not exists name       text,
  add column if not exists lead_email text;
