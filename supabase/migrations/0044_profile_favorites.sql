-- Pinned conversations at the top of the dashboard (the iMessage
-- "Favorites" row). Stored as a small JSONB array on profiles so we
-- don't need a whole new table — just a per-user list of
-- { kind, id } pointers.
--
-- kind: 'owned' | 'shared' | 'group' | 'together'
-- id:   uuid of the oracle, oracle, group_room, or beneficiary_room
--
-- Empty default keeps the column safe for everyone who hasn't
-- favorited anything yet.

alter table public.profiles
  add column if not exists favorites jsonb not null default '[]'::jsonb;

comment on column public.profiles.favorites is
  'Pinned conversations (favorites row on dashboard). Array of {kind, id}.';
