-- chapter3five — enable Supabase Realtime on the messages table.
--
-- Without this, mobile + web clients can only see new messages by
-- refreshing. With it, when the proactive cron inserts a new message
-- (or a future feature does), every device that's currently subscribed
-- gets the row pushed via websocket and renders it inline. That's what
-- makes "your thirtyfive just texted you" feel like an actual text and
-- not a delayed email.
--
-- RLS still applies — clients only receive rows they could read with
-- a regular select. The user_id check on the messages policy keeps
-- one user from seeing another user's pushes.

alter publication supabase_realtime add table public.messages;
