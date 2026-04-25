-- chapter3five — share codes
--
-- A user can mint share codes that let another user import a full copy of
-- the archive (profile fields + every recorded answer) into their own
-- account. Use case: a person fills out their own questions, then shares
-- the code with family so each person can carry their own copy after.
--
-- Codes are revocable. They are NOT one-time-use by default — a code can be
-- imported by multiple recipients until revoked.

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  source_user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  label text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shares_source_user_idx on public.shares (source_user_id);
create index if not exists shares_code_idx on public.shares (code);

alter table public.shares enable row level security;

-- The source user can see / manage their own codes.
create policy "shares: source can read their own"
  on public.shares for select
  using (auth.uid() = source_user_id);

create policy "shares: source can insert their own"
  on public.shares for insert
  with check (auth.uid() = source_user_id);

create policy "shares: source can update their own"
  on public.shares for update
  using (auth.uid() = source_user_id);

-- Any authenticated user can look up a non-revoked code (so the import flow
-- can resolve it). Codes are random and long enough that brute force is
-- infeasible (~36^12 possibilities).
create policy "shares: authenticated lookup of active codes"
  on public.shares for select
  to authenticated
  using (revoked_at is null);
