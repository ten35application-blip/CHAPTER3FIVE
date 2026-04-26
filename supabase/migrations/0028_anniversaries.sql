-- chapter3five — anniversary acknowledgments.
--
-- A daily cron checks each active user's birthday, signup-aversary,
-- and the day they first spoke to their identity. On those days the
-- identity sends a short proactive message acknowledging it — like
-- a real person who remembers dates. We track which anniversaries
-- have fired this year so the same one doesn't double-send when the
-- cron runs more than once on the day, or if it retries.

create table if not exists public.anniversary_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  kind text not null check (kind in ('birthday', 'signup', 'first_message')),
  year int not null,
  sent_at timestamptz not null default now(),
  unique (user_id, oracle_id, kind, year)
);

create index if not exists anniversary_ack_user_idx
  on public.anniversary_acknowledgments (user_id);

alter table public.anniversary_acknowledgments enable row level security;
-- Service role only.
