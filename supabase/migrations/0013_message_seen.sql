-- chapter3five — track when the user last saw their messages, so we can
-- surface a badge for unread proactive (or otherwise unseen) replies.
alter table public.profiles
  add column if not exists last_message_seen_at timestamptz;
