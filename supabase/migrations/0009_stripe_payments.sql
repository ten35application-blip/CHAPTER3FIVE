-- chapter3five — Stripe payments + randomize allowance tracking
--
-- Each user gets one free randomize. Subsequent randomizes require a $5
-- one-time Stripe Checkout. We track how many they've used + persist a
-- payments audit trail.

alter table public.profiles
  add column if not exists randomize_count integer not null default 0,
  add column if not exists randomize_credits integer not null default 1;

-- credits semantics:
--   randomize_count    : how many randomizes they've actually generated
--   randomize_credits  : how many they CAN generate right now
-- New users start with 1 free credit; webhook adds 1 per successful payment;
-- the randomize action decrements credits + increments count.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  amount_cents integer not null,
  currency text not null default 'usd',
  purpose text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payments_user_idx on public.payments (user_id);
create index if not exists payments_status_idx on public.payments (status);

alter table public.payments enable row level security;

-- Users can read their own payment history.
create policy "payments: users see their own"
  on public.payments for select using (auth.uid() = user_id);

-- Inserts and updates happen server-side via service role only.

-- Backfill: existing users who already used their free randomize end up at
-- randomize_count = 1, randomize_credits = 0. We can detect that by checking
-- for a randomize-mode profile that already has answers.
update public.profiles
set randomize_count = 1, randomize_credits = 0
where mode = 'randomize'
  and id in (select user_id from public.answers limit 1);
