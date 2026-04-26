-- chapter3five — multi-oracle answer separation, crisis flags, outreach.

-- 1. Drop the original user_id-based unique constraint on answers so a
--    single user can hold multiple oracles, each with their own answer set.
--    The oracle_id-based constraint added in 0002 is now canonical.
alter table public.answers
  drop constraint if exists answers_user_id_question_id_variant_key;

-- 2. crisis_flags — server-side log of moments where a user message
--    tripped a safety keyword check. Used for care-team follow-up.
create table if not exists public.crisis_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_excerpt text,
  triggered_keywords text[],
  flagged_at timestamptz not null default now(),
  resolved_at timestamptz,
  notes text
);

create index if not exists crisis_flags_user_idx on public.crisis_flags (user_id);
create index if not exists crisis_flags_open_idx on public.crisis_flags (flagged_at) where resolved_at is null;

alter table public.crisis_flags enable row level security;

create policy "crisis_flags: users see their own"
  on public.crisis_flags for select using (auth.uid() = user_id);

create policy "crisis_flags: users insert their own"
  on public.crisis_flags for insert with check (auth.uid() = user_id);

-- 3. Outreach activity tracking columns on profiles.
alter table public.profiles
  add column if not exists last_active_at timestamptz default now(),
  add column if not exists last_outreach_at timestamptz,
  add column if not exists outreach_enabled boolean not null default true;
