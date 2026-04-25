-- chapter3five — allow 'import' as a profile mode
--
-- The original mode check constraint allowed only 'real' and 'randomize'.
-- 'import' lets a recipient onboard by entering someone else's share code.

alter table public.profiles
  drop constraint if exists profiles_mode_check;

alter table public.profiles
  add constraint profiles_mode_check
  check (mode in ('real', 'randomize', 'import'));

alter table public.oracles
  drop constraint if exists oracles_mode_check;

alter table public.oracles
  add constraint oracles_mode_check
  check (mode in ('real', 'randomize', 'import'));
