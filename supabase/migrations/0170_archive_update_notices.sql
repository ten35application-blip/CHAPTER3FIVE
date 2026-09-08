-- 0170 (2026-09-08): batch "X added to their archive" emails (applied via MCP).
create table if not exists public.archive_update_notices (
  copy_id uuid primary key references public.oracles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_name text not null,
  photo_changed boolean not null default false,
  answers_added integer not null default 0,
  answers_corrected integer not null default 0,
  first_at timestamptz not null default now(),
  due_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists archive_update_notices_due_idx on public.archive_update_notices(due_at);
alter table public.archive_update_notices enable row level security;
revoke all on public.archive_update_notices from anon, authenticated;
