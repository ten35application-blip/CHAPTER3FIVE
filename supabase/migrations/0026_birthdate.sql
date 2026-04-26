-- chapter3five — birthday on profile.
--
-- Collected during onboarding to:
--   1. Verify the user is 18+ (we already self-declare via a checkbox
--      at signup; this is the actual date that backs the claim).
--   2. Power future "happy birthday from your thirtyfive" features —
--      a real-feeling proactive message on the user's birthday.
--
-- Stored as a plain DATE (no time, no timezone), since the day of the
-- year is what matters and storing precise time would be misleading.

alter table public.profiles
  add column if not exists birthdate date;
