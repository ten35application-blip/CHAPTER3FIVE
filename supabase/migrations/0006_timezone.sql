-- chapter3five — timezone for sleep-schedule behavior
--
-- The chat surface treats the thirtyfive as asleep between 23:00-07:00 in
-- this timezone. Auto-detected from the user's browser on first chat;
-- editable later in Settings (when we ship that UI).

alter table public.profiles add column if not exists timezone text;
alter table public.oracles  add column if not exists timezone text;
