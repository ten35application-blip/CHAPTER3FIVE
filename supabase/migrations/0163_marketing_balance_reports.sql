-- 0163 — THE MARKETING ACCOUNT, REPORTED ON THE 1ST (Wilson 2026-09-02:
-- "the name of the bank is navy federal and every 1st of the month I
-- am going to report how much is in the Marketing account that comes
-- from the 27th to the 1st").
--
-- The separate account that receives the 27th → 1st money is the
-- MARKETING account at Navy Federal (the formula still calls it
-- growth* internally — the label changed, not the math). The formula
-- predicts what it should hold after each transfer day
-- (settlements.growth_balance_cents); on the 1st Wilson types what
-- the bank actually shows, and the two sit side by side so drift is
-- visible the day it happens. One row per settlement month = the
-- balance seen on the 1st right after that month's transfer day.
--
-- Applied to production 2026-09-02 via the Supabase MCP; kept here so
-- the schema is reproducible.

create table if not exists public.marketing_balance_reports (
  -- The settlement month this balance follows (reported on the 1st
  -- of the NEXT month, after the 27th transfer).
  month text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  balance_cents integer not null check (balance_cents >= 0),
  reported_on date not null default current_date,
  reported_by text,
  note text,
  updated_at timestamptz not null default now()
);
comment on table public.marketing_balance_reports is
  'What Navy Federal showed in the Marketing account on the 1st, keyed by the settlement month whose 27th transfer it follows. Service role only; compared against settlements.growth_balance_cents.';

alter table public.marketing_balance_reports enable row level security;
-- No policies on purpose: only the service role (admin server code)
-- reads or writes it. Revoke the default grants so RLS is not the
-- only wall.
revoke all on public.marketing_balance_reports from anon, authenticated;
