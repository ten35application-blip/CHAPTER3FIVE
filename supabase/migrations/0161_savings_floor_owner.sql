-- 0161 — WHO PUT THE SAVINGS FLOOR IN (Wilson 2026-09-02: "danisel put
-- the entire 255").
--
-- 0160 assumed the $255 was split evenly. It wasn't — it is Danisel's
-- capital alone, so the business owes her $255 and Pedro $0 for it.
-- The setting names the partner; NULL keeps the even split for any
-- future floor the members put in together.
--
-- Applied to production 2026-09-02 via the Supabase MCP; kept here so
-- the schema is reproducible.

alter table public.business_settings
  add column if not exists locked_savings_by text;

comment on column public.business_settings.locked_savings_by is
  'Partner name whose capital the savings floor is (must match partner_a or partner_b). NULL = split evenly.';

update public.business_settings
set locked_savings_by = 'Danisel'
where id = true;
