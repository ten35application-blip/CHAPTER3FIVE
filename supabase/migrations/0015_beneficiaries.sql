-- chapter3five — beneficiaries (digital legacy handoff).
--
-- Owner designates 1-3 beneficiaries for free, $5 per additional one.
-- When admin marks the owner deceased, each beneficiary gets an email with
-- a claim link. On claim, they receive an archive_grant for every oracle
-- the deceased owned, so they can read + chat with the archive.

alter table public.profiles
  add column if not exists paid_beneficiary_slots int not null default 0,
  add column if not exists deceased_at timestamptz,
  add column if not exists deceased_confirmed_by uuid references auth.users(id);

create table if not exists public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text,
  claim_token text not null unique,
  status text not null default 'designated'
    check (status in ('designated', 'activated', 'claimed', 'declined', 'removed')),
  notified_at timestamptz,
  activated_at timestamptz,
  claimed_at timestamptz,
  claimed_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, email)
);

create index if not exists beneficiaries_owner_idx
  on public.beneficiaries (owner_user_id);
create index if not exists beneficiaries_token_idx
  on public.beneficiaries (claim_token);

alter table public.beneficiaries enable row level security;

drop policy if exists "beneficiaries: owner reads" on public.beneficiaries;
drop policy if exists "beneficiaries: owner inserts" on public.beneficiaries;
drop policy if exists "beneficiaries: owner updates" on public.beneficiaries;
drop policy if exists "beneficiaries: owner deletes" on public.beneficiaries;
drop policy if exists "beneficiaries: token lookup" on public.beneficiaries;

create policy "beneficiaries: owner reads"
  on public.beneficiaries for select
  using (auth.uid() = owner_user_id);
create policy "beneficiaries: owner inserts"
  on public.beneficiaries for insert
  with check (auth.uid() = owner_user_id);
create policy "beneficiaries: owner updates"
  on public.beneficiaries for update
  using (auth.uid() = owner_user_id);
create policy "beneficiaries: owner deletes"
  on public.beneficiaries for delete
  using (auth.uid() = owner_user_id);
-- Authenticated users can look up an activated row by token (to claim).
create policy "beneficiaries: token lookup"
  on public.beneficiaries for select
  to authenticated
  using (status = 'activated');
