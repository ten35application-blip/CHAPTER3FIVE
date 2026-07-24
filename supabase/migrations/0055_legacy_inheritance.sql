-- ============================================================================
-- 0055_legacy_inheritance.sql
--
-- WILSON — RUN THIS YOURSELF. Either:
--   Supabase Studio → SQL Editor → New query → paste → Run
--   or from the repo root: npx supabase db push
--   (or: psql "$DATABASE_URL" -f supabase/migrations/0055_legacy_inheritance.sql)
--
-- Adds the "For someone to keep" legacy path:
--   1. oracles gains is_legacy / legacy_answers / created_by
--   2. legacy_drafts    — autosaved in-progress answers (one draft per user)
--   3. inherit_codes    — human-readable share codes (chapter-4291-heart-elm)
--   4. oracle_shares    — who has redeemed a code for which oracle
--   5. RLS so the identity stays readable to the creator AND to redeemers
--
-- Redemption lookups + oracle_shares inserts happen through the service-role
-- client server-side, so there is deliberately NO authenticated-lookup policy
-- on inherit_codes — codes can't be enumerated through PostgREST.
--
-- Additive + idempotent. Safe to run twice.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. oracles: legacy columns
-- ----------------------------------------------------------------------------
alter table public.oracles
  add column if not exists is_legacy boolean not null default false,
  add column if not exists legacy_answers jsonb,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Backfill: for existing rows the owner is the creator.
update public.oracles set created_by = user_id where created_by is null;

-- ----------------------------------------------------------------------------
-- 2. legacy_drafts: autosave for the 40-question flow. One draft per user —
--    leave and come back. Deleted on completion.
-- ----------------------------------------------------------------------------
create table if not exists public.legacy_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  subject jsonb not null default '{}'::jsonb,   -- {name, relationship, era, heritage}
  answers jsonb not null default '{}'::jsonb,   -- {question_id: answer_text}
  current_step integer not null default 0,      -- 0 = subject page, 1..40 = questions
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legacy_drafts enable row level security;

drop policy if exists "legacy_drafts: users read own" on public.legacy_drafts;
create policy "legacy_drafts: users read own"
  on public.legacy_drafts for select using (auth.uid() = user_id);

drop policy if exists "legacy_drafts: users insert own" on public.legacy_drafts;
create policy "legacy_drafts: users insert own"
  on public.legacy_drafts for insert with check (auth.uid() = user_id);

drop policy if exists "legacy_drafts: users update own" on public.legacy_drafts;
create policy "legacy_drafts: users update own"
  on public.legacy_drafts for update using (auth.uid() = user_id);

drop policy if exists "legacy_drafts: users delete own" on public.legacy_drafts;
create policy "legacy_drafts: users delete own"
  on public.legacy_drafts for delete using (auth.uid() = user_id);

drop trigger if exists legacy_drafts_touch_updated_at on public.legacy_drafts;
create trigger legacy_drafts_touch_updated_at
  before update on public.legacy_drafts
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 3. inherit_codes: chapter-XXXX-word-word. Never expire; creator can revoke
--    by setting revoked_at. Multiple recipients may redeem one code.
-- ----------------------------------------------------------------------------
create table if not exists public.inherit_codes (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists inherit_codes_oracle_idx on public.inherit_codes (oracle_id);

alter table public.inherit_codes enable row level security;

-- Creator manages their own codes. user_owns_oracle() is the SECURITY DEFINER
-- helper from 0040 — avoids RLS recursion into oracles.
drop policy if exists "inherit_codes: creator reads own" on public.inherit_codes;
create policy "inherit_codes: creator reads own"
  on public.inherit_codes for select using (auth.uid() = created_by);

drop policy if exists "inherit_codes: creator inserts for own oracle" on public.inherit_codes;
create policy "inherit_codes: creator inserts for own oracle"
  on public.inherit_codes for insert
  with check (auth.uid() = created_by and public.user_owns_oracle(oracle_id));

drop policy if exists "inherit_codes: creator revokes own" on public.inherit_codes;
create policy "inherit_codes: creator revokes own"
  on public.inherit_codes for update using (auth.uid() = created_by);

-- No authenticated-lookup policy on purpose: redemption resolves the code via
-- the service-role client, so codes can't be probed from the client.

-- ----------------------------------------------------------------------------
-- 4. oracle_shares: a redeemed code attaches the oracle to the recipient.
--    Rows are inserted by the service-role client during redemption.
-- ----------------------------------------------------------------------------
create table if not exists public.oracle_shares (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_id uuid references public.inherit_codes(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (oracle_id, user_id)
);

create index if not exists oracle_shares_user_idx on public.oracle_shares (oracle_id, user_id);

alter table public.oracle_shares enable row level security;

drop policy if exists "oracle_shares: recipient reads own" on public.oracle_shares;
create policy "oracle_shares: recipient reads own"
  on public.oracle_shares for select using (auth.uid() = user_id);

drop policy if exists "oracle_shares: owner reads shares on their oracle" on public.oracle_shares;
create policy "oracle_shares: owner reads shares on their oracle"
  on public.oracle_shares for select using (public.user_owns_oracle(oracle_id));

drop policy if exists "oracle_shares: recipient can leave" on public.oracle_shares;
create policy "oracle_shares: recipient can leave"
  on public.oracle_shares for delete using (auth.uid() = user_id);

-- Inserts happen only via the service-role client (bypasses RLS) — no insert
-- policy needed for regular users.

-- ----------------------------------------------------------------------------
-- 5. Recipients can read the shared oracle. SECURITY DEFINER helper mirrors
--    the 0040 pattern so oracles RLS and oracle_shares RLS don't recurse.
-- ----------------------------------------------------------------------------
create or replace function public.user_has_share_on_oracle(p_oracle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.oracle_shares
    where oracle_id = p_oracle_id and user_id = auth.uid()
  );
$$;

drop policy if exists "oracles: recipients read via share" on public.oracles;
create policy "oracles: recipients read via share"
  on public.oracles for select
  using (public.user_has_share_on_oracle(id));
