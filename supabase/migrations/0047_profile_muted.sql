-- chapter3five — muted conversations.
--
-- Mirrors what iMessage calls "Hide Alerts" and Google Messages
-- calls mute: the conversation stays in the list, but no
-- proactive/outreach pings or push notifications fire for it. The
-- row also shows a small bell-with-slash icon next to the timestamp
-- so the owner remembers it's silenced.
--
-- Stored as a JSONB array of { kind, id }, same shape as profile
-- favorites — read by the dashboard and respected by the proactive
-- + outreach + check-in crons.

alter table public.profiles
  add column if not exists muted_conversations jsonb not null default '[]'::jsonb;
