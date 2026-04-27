-- chapter3five — per-conversation read timestamps stored as a single
-- JSONB blob on the profile. Lets the dashboard show unread badges
-- on conversations with new messages without a separate per-user
-- per-conversation table.
--
-- Shape: { "owned:<oracleId>": "2026-01-...", "group:<roomId>": "...", ... }
--
-- Updated by the conversation pages on load (when the user opens
-- a chat, we stamp now() for that key).

alter table public.profiles
  add column if not exists last_read jsonb not null default '{}'::jsonb;
