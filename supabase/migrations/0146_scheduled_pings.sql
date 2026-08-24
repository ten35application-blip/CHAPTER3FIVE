-- A promise a companion made about WHEN it will text next.
--
-- "Text me in the morning?" — the persona says okay, and okay has to
-- mean something. Rows are written server-side when the promise
-- detector (lib/promises/extract.ts) spots an agreed future contact in
-- a fresh exchange, and consumed by the promised-pings cron, which
-- composes the message in the persona's own voice at (or near) the
-- promised time. A cron that misses the window by hours delivers late
-- WITH an apology — which is more human than on time, not less.
--
-- Service-role only. No client ever reads or writes these: the whole
-- point is that the promise surfaces as a message, not as UI.
create table if not exists scheduled_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  oracle_id uuid not null references oracles (id) on delete cascade,
  due_at timestamptz not null,
  context text not null,
  source_message_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'skipped')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists scheduled_pings_due
  on scheduled_pings (status, due_at)
  where status = 'pending';

create unique index if not exists scheduled_pings_one_pending_per_pair
  on scheduled_pings (user_id, oracle_id)
  where status = 'pending';

alter table scheduled_pings enable row level security;
revoke all on scheduled_pings from public, anon, authenticated;
