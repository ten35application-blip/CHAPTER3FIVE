-- chapter3five — per-user daily chat usage counter for rate limiting.
-- Used by /api/chat to enforce a daily message cap before calling
-- Anthropic, so a single bad actor (or a runaway client) can't blow the
-- API budget overnight.

create table if not exists public.chat_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  message_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists chat_usage_day_idx on public.chat_usage (day desc);

alter table public.chat_usage enable row level security;
-- Only the service role touches this; users can read their own to show
-- "X messages remaining today" if we want a UI hint later.
drop policy if exists "chat_usage: owner reads" on public.chat_usage;
create policy "chat_usage: owner reads"
  on public.chat_usage for select
  using (auth.uid() = user_id);

-- Atomic per-day increment that returns the new count. Upserts the row
-- if today's row doesn't exist yet.
create or replace function public.bump_chat_usage(target_user_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_count int;
begin
  insert into public.chat_usage (user_id, day, message_count, updated_at)
  values (target_user_id, current_date, 1, now())
  on conflict (user_id, day) do update
    set message_count = public.chat_usage.message_count + 1,
        updated_at = now()
  returning message_count into new_count;

  return new_count;
end;
$$;

revoke all on function public.bump_chat_usage(uuid) from public;
revoke all on function public.bump_chat_usage(uuid) from anon;
revoke all on function public.bump_chat_usage(uuid) from authenticated;
