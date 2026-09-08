-- Talk to your own archive (2026-09-08). When a message to your OWN
-- original archive reads like something to keep but the sorter isn't
-- sure, we ask "Keep this?" and park the text here until the next
-- reply says yes or no. One pending item per archive. Server-only:
-- RLS on, no policies — only the service role reads or writes it.
create table if not exists public.self_talk_pending (
  oracle_id uuid primary key references public.oracles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  question_id text not null,
  created_at timestamptz not null default now()
);
alter table public.self_talk_pending enable row level security;
revoke all on public.self_talk_pending from anon, authenticated;

-- Replies from the sorter are tagged initiated_by = 'self_talk' so the
-- chat routes can keep them out of the archive's memory.
alter table public.messages drop constraint if exists messages_initiated_by_check;
alter table public.messages add constraint messages_initiated_by_check check (initiated_by is null or initiated_by = any (array['user','persona','proactive','anniversary','check_in','daily_question','system','concierge','promise','birthday','self_talk']));
