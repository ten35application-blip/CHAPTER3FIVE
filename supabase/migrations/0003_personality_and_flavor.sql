-- chapter3five — personality_type + emotional_flavor on randomized characters
--
-- Adds two columns to profiles. Assigned at randomize-time and used by the
-- chat system prompt to layer a coherent character on top of the per-question
-- random answers. Additive — safe to apply at any time.

alter table public.profiles
  add column if not exists personality_type text,
  add column if not exists emotional_flavor text;

-- Same fields exist on oracles for the multi-oracle world.
alter table public.oracles
  add column if not exists personality_type text,
  add column if not exists emotional_flavor text;
