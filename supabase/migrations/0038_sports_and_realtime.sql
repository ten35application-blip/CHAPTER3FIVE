-- Sports fandom (optional, completely random) + realtime support so
-- "X left the chat" updates in the group room live, not on next refresh.

alter table public.oracles
  add column if not exists sports_fandom jsonb,
  add column if not exists sports_extracted_at timestamptz;

comment on column public.oracles.sports_fandom is
  'Optional. Shape: { teams: [{ league, team, intensity }] }. Rolled randomly — most personas have no team at all.';
comment on column public.oracles.sports_extracted_at is
  'When sports were last extracted/rolled. Null = never tried.';

-- Carry group room membership changes (left_at flips) over realtime so
-- the client UI marks departed personas without a refresh.
alter publication supabase_realtime add table public.group_room_members;
