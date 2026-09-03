-- 0162 — WHO COVERS A LOSS THE RESERVE CAN'T (Wilson 2026-09-02:
-- asked who paid September's ~$262 shortfall → "Danisel.").
--
-- Until the business card and the $175s arrive (October 1), a month
-- whose bills exceed sales + reserve is paid out of someone's pocket.
-- Naming them here books the shortfall as THEIR capital — owed back
-- like the $175s, not income, not split. NULL leaves it flagged and
-- unassigned (never silently split). Frozen months don't recompute.
--
-- Applied to production 2026-09-02 via the Supabase MCP; kept here so
-- the schema is reproducible.

alter table public.business_settings
  add column if not exists shortfall_paid_by text;

comment on column public.business_settings.shortfall_paid_by is
  'Partner name who pays a loss the reserve cannot cover (must match partner_a or partner_b); booked as their capital. NULL = unassigned, flagged only.';

update public.business_settings
set shortfall_paid_by = 'Danisel'
where id = true;
