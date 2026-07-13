-- Standard order timeline is 10 business days (see the services-page FAQ and the
-- inHandsWindow / checkout fallbacks, which already assumed 10). The original
-- schema defaulted lead_time_days to 7 and every seeded/imported product carried
-- 7, so customer-facing "ships in ~N days" / "in hands by" estimates were a few
-- days short of the real standard. Bring the column default and the existing
-- rows up to 10. Products intentionally set to something other than the old 7
-- default are left untouched.
alter table public.products alter column lead_time_days set default 10;

update public.products set lead_time_days = 10 where lead_time_days = 7;
