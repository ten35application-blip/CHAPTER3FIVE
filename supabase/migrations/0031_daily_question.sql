-- chapter3five — daily question nudge tracking.
--
-- A daily cron picks users who haven't finished onboarding (real
-- mode, < 355 answers) and pings them with one specific unanswered
-- question — push notification + tap to deep-link straight into the
-- answer screen. Combined with voice + Whisper, "answer one today"
-- is 30 seconds of effort. The metric we expect to move: onboarding
-- completion rate.
--
-- We track last fire on the profile so the cron can run frequently
-- without double-pinging.

alter table public.profiles
  add column if not exists last_daily_question_at timestamptz;

create index if not exists profiles_last_daily_question_idx
  on public.profiles (last_daily_question_at)
  where last_daily_question_at is not null;
