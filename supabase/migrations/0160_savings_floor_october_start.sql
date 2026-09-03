-- 0160 — THE SAVINGS FLOOR + OCTOBER START (Wilson 2026-09-02: "the
-- 175 goes in october 1st for both me and pedro thats when the money
-- in starts, we had to put 255 in savings and its staying there").
--
-- Two facts the formula now carries:
--   • member contributions begin 2026-10, not 2026-09 (September
--     shows $0 from both members, and its loss is an out-of-pocket
--     shortfall — flagged, never hidden);
--   • $255 sits in the savings account as the bank's minimum. It is
--     the members' capital (split evenly, owed back like the $175s),
--     but it is NOT the operating reserve, NOT the growth account, and
--     never spent — it shows as its own line on every surface.
--
-- Applied to production 2026-09-02 via the Supabase MCP; kept here so
-- the schema is reproducible.

alter table public.business_settings
  add column if not exists locked_savings_cents integer not null default 0,
  add column if not exists locked_savings_month text;

comment on column public.business_settings.locked_savings_cents is
  'The bank''s savings minimum, deposited once by the members (capital). Sits in savings; never reserve, never growth, never spent.';
comment on column public.business_settings.locked_savings_month is
  'YYYY-MM the savings floor went in — that month shows the deposit and splits it into each member''s capital; later months show only the balance.';

update public.business_settings
set member_contributions_start_month = '2026-10',
    locked_savings_cents = 25500,
    locked_savings_month = '2026-09'
where id = true;
