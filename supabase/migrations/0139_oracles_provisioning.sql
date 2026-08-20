-- Backfill migration (ultrareview 2026-08-19 finding #1): the
-- atomic-reveal work (all-or-nothing companion delivery) added
-- oracles.provisioning straight to production via the management API
-- during the 2026-08-16 billing drills, but no migration file ever
-- landed — so a fresh environment breaks on the first formula-identity
-- insert (42703) and the dashboard SELECT. This file reproduces the
-- production DDL exactly; IF NOT EXISTS makes it a no-op where the
-- column already lives.
--
-- Semantics: true while a paid delivery is being synthesized (rows
-- hidden from the dashboard until the whole circle is ready), false
-- the moment it completes. Default false = every non-reveal insert
-- path (photo, legacy, inherited copies) is visible immediately,
-- which is correct — those rows are complete at insert time.

alter table public.oracles
  add column if not exists provisioning boolean not null default false;

-- User clients read the flag on dashboard queries (security rule:
-- a new column on a user-reachable table gets its SELECT grant in
-- the same migration). Idempotent — re-granting is harmless.
grant select (provisioning) on public.oracles to authenticated;
