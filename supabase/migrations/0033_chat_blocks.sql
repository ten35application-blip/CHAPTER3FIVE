-- chat_blocks: when the persona refuses to engage with hostile or
-- cruel messages from a specific user. One row per incident; the most
-- recent active row (unblocked_at IS NULL) is the gate.
--
-- The cron at /api/cron/check-in walks rows with blocked_until in the
-- past and unblocked_at IS NULL, marks them unblocked, and inserts a
-- persona-initiated message asking how the user is doing.

create table if not exists public.chat_blocks (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_at timestamptz not null default now(),
  blocked_until timestamptz not null,
  severity text not null check (severity in ('moderate', 'severe', 'critical')),
  reason text,
  unblocked_at timestamptz,
  checkin_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chat_blocks_active_idx
  on public.chat_blocks (oracle_id, user_id)
  where unblocked_at is null;

create index if not exists chat_blocks_pending_unblock_idx
  on public.chat_blocks (blocked_until)
  where unblocked_at is null;

alter table public.chat_blocks enable row level security;

create policy "users see their own blocks"
  on public.chat_blocks
  for select
  using (auth.uid() = user_id);

-- No client insert/update/delete — only the chat route + cron use the
-- service role to manage these rows.
