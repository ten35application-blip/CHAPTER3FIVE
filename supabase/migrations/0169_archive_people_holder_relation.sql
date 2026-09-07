-- 0169 (2026-09-07): who an archive is for, and who is holding a copy.
-- Applied via MCP the same night. See lib/legacy/relation.ts.
create table if not exists public.archive_people (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relation text not null,
  email text,
  birthday date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists archive_people_oracle_idx on public.archive_people(oracle_id);
alter table public.archive_people enable row level security;
revoke all on public.archive_people from anon, authenticated;
alter table public.oracles add column if not exists holder_relation jsonb;
grant select (holder_relation) on public.oracles to authenticated;
