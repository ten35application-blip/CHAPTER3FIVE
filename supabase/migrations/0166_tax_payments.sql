-- Tax payments actually sent, in each member's own name, out of the
-- operating account. The tax envelope the formula holds for a member
-- drains by what was paid (see computeBreakdown). Danisel pays four times
-- a year (IRS + PA on Apr 15 / Jun 15 / Sep 15 / Jan 15; Bethlehem via
-- Keystone on Apr 15 / Jul 15 / Oct 15 / Jan 15); Pedro pays once in
-- December. A payment counts in the settlement month whose window holds
-- its paid_on date; one recorded after that month froze is swept into the
-- next open month (same rule as late store payouts).
create table if not exists public.tax_payments (
  id uuid primary key default gen_random_uuid(),
  partner text not null,
  paid_on date not null,
  amount_cents integer not null check (amount_cents > 0),
  government text not null check (government in ('federal', 'state', 'city', 'local')),
  note text,
  recorded_by text,
  created_at timestamptz not null default now()
);

comment on table public.tax_payments is
  'Estimated-tax payments sent from the operating account in a member''s name; drains that member''s held tax envelope in the month whose window holds paid_on. Admin-only (service role); no client policies.';

create index if not exists tax_payments_paid_on_idx on public.tax_payments (paid_on);
create index if not exists tax_payments_created_at_idx on public.tax_payments (created_at);

alter table public.tax_payments enable row level security;
-- No policies on purpose: only the service role (admin pages, API routes,
-- cron) reads or writes this table.
revoke all on public.tax_payments from anon, authenticated;
