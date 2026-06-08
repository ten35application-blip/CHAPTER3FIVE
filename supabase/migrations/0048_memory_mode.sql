-- chapter3five — memory mode for identities.
--
-- A new way to start an archive: the user describes a person in
-- free text and we synthesize a starter persona from it. The
-- persona keeps growing as they keep talking. Used when someone
-- wants to record a loved one without filling out 355 questions.
--
-- mode = 'memory' joins 'real' (you fill the archive), 'randomize'
-- (we mix one), and 'import' (start from someone else's archive).

alter table public.profiles
  drop constraint if exists profiles_mode_check;
alter table public.profiles
  add constraint profiles_mode_check
  check (mode in ('real', 'randomize', 'import', 'memory'));

alter table public.oracles
  drop constraint if exists oracles_mode_check;
alter table public.oracles
  add constraint oracles_mode_check
  check (mode in ('real', 'randomize', 'memory'));

-- The original free-text seed the user gave us. Preserved on the
-- oracle so we can re-synthesize / re-explain / show the user what
-- the persona was built from.
alter table public.oracles
  add column if not exists memory_seed text;

-- When the persona last asked the user a clarifying question
-- ("tell me more about ___"). Used to throttle the asking so it
-- doesn't feel needy.
alter table public.oracles
  add column if not exists memory_last_asked_at timestamptz;

comment on column public.oracles.memory_seed is
  'Original free-text description the user provided when creating a memory-mode identity. Kept so we can show the source material and re-derive if needed.';
comment on column public.oracles.memory_last_asked_at is
  'When the persona last asked the user a clarifying question to deepen the archive. Throttles the asking cadence.';
