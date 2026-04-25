-- chapter3five — multi-oracle support
--
-- This migration is ADDITIVE. Old columns on `profiles` (oracle_name, mode,
-- texting_style, onboarding_completed) are NOT dropped; existing code that
-- reads them keeps working. New code can read the canonical record from the
-- `oracles` table instead.
--
-- Apply via Supabase Studio → SQL Editor → New query → Run.

-- ============================================================================
-- 1. oracles: the personas a user has created
-- ============================================================================
create table if not exists public.oracles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mode text not null default 'real' check (mode in ('real', 'randomize')),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'es')),
  texting_style text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oracles_user_idx on public.oracles (user_id);

alter table public.oracles enable row level security;

create policy "oracles: users can read their own oracles"
  on public.oracles for select using (auth.uid() = user_id);
create policy "oracles: users can insert their own oracles"
  on public.oracles for insert with check (auth.uid() = user_id);
create policy "oracles: users can update their own oracles"
  on public.oracles for update using (auth.uid() = user_id);
create policy "oracles: users can delete their own oracles"
  on public.oracles for delete using (auth.uid() = user_id);

drop trigger if exists oracles_touch_updated_at on public.oracles;
create trigger oracles_touch_updated_at
  before update on public.oracles
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 2. Backfill: convert each existing profile with an oracle_name into
--    one row in oracles.
-- ============================================================================
insert into public.oracles (user_id, name, mode, preferred_language, texting_style, onboarding_completed, created_at, updated_at)
select
  p.id,
  p.oracle_name,
  coalesce(p.mode, 'real'),
  coalesce(p.preferred_language, 'en'),
  p.texting_style,
  coalesce(p.onboarding_completed, false),
  p.created_at,
  p.updated_at
from public.profiles p
where p.oracle_name is not null
  and not exists (
    select 1 from public.oracles o where o.user_id = p.id
  );

-- ============================================================================
-- 3. profiles.active_oracle_id — which oracle the user currently has selected.
--    Defaults to the user's only/oldest oracle after backfill.
-- ============================================================================
alter table public.profiles
  add column if not exists active_oracle_id uuid references public.oracles(id) on delete set null;

update public.profiles p
set active_oracle_id = (
  select o.id from public.oracles o
  where o.user_id = p.id
  order by o.created_at asc
  limit 1
)
where p.active_oracle_id is null;

-- ============================================================================
-- 4. answers.oracle_id — answers belong to an oracle, not directly to a user.
--    Backfill from each user's only/oldest oracle.
-- ============================================================================
alter table public.answers
  add column if not exists oracle_id uuid references public.oracles(id) on delete cascade;

update public.answers a
set oracle_id = (
  select o.id from public.oracles o
  where o.user_id = a.user_id
  order by o.created_at asc
  limit 1
)
where a.oracle_id is null
  and exists (select 1 from public.oracles o where o.user_id = a.user_id);

create index if not exists answers_oracle_idx on public.answers (oracle_id);
create index if not exists answers_oracle_question_idx on public.answers (oracle_id, question_id);

-- New unique constraint by oracle (added alongside the user-based one for now;
-- we can drop the old constraint in a future migration once code is migrated).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'answers_oracle_question_variant_unique'
  ) then
    alter table public.answers
      add constraint answers_oracle_question_variant_unique unique (oracle_id, question_id, variant);
  end if;
end $$;

-- ============================================================================
-- 5. Updated RLS for answers (oracle-based read/write paths).
--    Old user-based policies remain in force for backward compatibility;
--    we add NEW policies that allow the same access via the oracle FK.
-- ============================================================================
create policy "answers: users can read via oracle"
  on public.answers for select
  using (
    exists (
      select 1 from public.oracles o
      where o.id = answers.oracle_id and o.user_id = auth.uid()
    )
  );

create policy "answers: users can insert via oracle"
  on public.answers for insert
  with check (
    exists (
      select 1 from public.oracles o
      where o.id = answers.oracle_id and o.user_id = auth.uid()
    )
  );

create policy "answers: users can update via oracle"
  on public.answers for update
  using (
    exists (
      select 1 from public.oracles o
      where o.id = answers.oracle_id and o.user_id = auth.uid()
    )
  );

create policy "answers: users can delete via oracle"
  on public.answers for delete
  using (
    exists (
      select 1 from public.oracles o
      where o.id = answers.oracle_id and o.user_id = auth.uid()
    )
  );

-- A future migration (0003) will:
--   - require answers.oracle_id NOT NULL
--   - drop the old user-based RLS policies on answers
--   - drop oracle_name, mode, texting_style, onboarding_completed from profiles
-- We hold off until application code is fully migrated.
