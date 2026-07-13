-- Order numbers get referenced constantly (phone, email, on the job ticket), so
-- switch from DH-{year}-{padded} to a plain incrementing number starting at 1000.
-- Simple to say, simple to type, no year prefix to explain.

alter sequence public.order_number_seq restart with 1000;

create or replace function public.assign_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := nextval('public.order_number_seq')::text;
  end if;
  return new;
end; $$;
