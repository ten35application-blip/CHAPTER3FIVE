-- chapter3five — passing reports (Phase 2 of the inheritance flow).
--
-- A beneficiary submits a "passing report" via their pre-shared
-- /legacy/[token] link. We DO NOT immediately unlock the archive.
-- Instead, the report sits in 'pending' status for 72 hours. The
-- owner gets an email with a one-click veto link. If they click it
-- in the window → 'vetoed', archive stays locked, reporter gets a
-- "couldn't verify" email. If 72h passes with no veto → daily cron
-- flips status to 'confirmed', stamps profiles.deceased_at, and
-- activates each beneficiary so claim links work.
--
-- The 72h window is the safety net. False reports (drama, fraud,
-- accidents) get caught here before anything irreversible happens.

create table if not exists public.passing_reports (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  -- Who submitted the report. Email is required; user_id only set
  -- if they were signed in. We store the email separately so a
  -- non-account beneficiary (the typical case) can still report.
  reporter_email text not null,
  reporter_name text,
  reporter_user_id uuid references auth.users(id) on delete set null,
  -- The beneficiary token they reported through (for traceability).
  beneficiary_id uuid references public.beneficiaries(id) on delete set null,
  passed_on date,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'vetoed', 'confirmed')),
  veto_token text not null unique,
  submitted_at timestamptz not null default now(),
  veto_deadline timestamptz not null,
  vetoed_at timestamptz,
  confirmed_at timestamptz
);

create index if not exists passing_reports_owner_idx
  on public.passing_reports (owner_user_id);
create index if not exists passing_reports_status_idx
  on public.passing_reports (status);
create index if not exists passing_reports_deadline_idx
  on public.passing_reports (veto_deadline)
  where status = 'pending';
create index if not exists passing_reports_veto_token_idx
  on public.passing_reports (veto_token);

alter table public.passing_reports enable row level security;
-- Service role + the actions below handle access. No client-side
-- writes; all submissions go through server actions / cron.
