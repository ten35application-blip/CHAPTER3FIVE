-- chapter3five — paid extra thirtyfives + proactive messaging tracking.

-- Each new thirtyfive after the first auto-created one costs $5.
-- The webhook grants one credit per Stripe payment.
alter table public.profiles
  add column if not exists extra_oracle_credits integer not null default 0;

-- Track when the proactive cron last sent a message from this user's
-- thirtyfive, so we don't spam them.
alter table public.profiles
  add column if not exists last_proactive_at timestamptz;

-- Optional small column to mark a message as proactive (initiated by the
-- thirtyfive, not in response to a user message). Useful for UI hints
-- like "you have a new message" badges later.
alter table public.messages
  add column if not exists initiated_by_oracle boolean not null default false;
