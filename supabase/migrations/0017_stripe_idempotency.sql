-- chapter3five — Stripe webhook idempotency + atomic credit grants.
--
-- The webhook can be retried by Stripe (network blip, our 5xx, replay) and
-- we never want to grant the same credit twice. We dedupe by Stripe's
-- event id + add an atomic increment RPC so credit grants are race-safe.

-- 1. Idempotency: store the Stripe event id once-per-event.
create table if not exists public.stripe_events (
  id text primary key,                       -- Stripe event id, e.g. "evt_..."
  type text not null,                        -- "checkout.session.completed", etc.
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists stripe_events_user_idx on public.stripe_events (user_id);
create index if not exists stripe_events_type_idx on public.stripe_events (type);

-- Service-role only.
alter table public.stripe_events enable row level security;

-- 2. Track which Stripe event paid each row (so refunds can find/revert it).
alter table public.payments
  add column if not exists stripe_event_id text,
  add column if not exists refunded_at timestamptz;

create index if not exists payments_event_idx
  on public.payments (stripe_event_id);

-- 3. Atomic, race-safe credit increment. Returns the new value.
--    Using one function for all three columns keeps the webhook simple.
create or replace function public.increment_profile_counter(
  target_user_id uuid,
  counter_name text,
  delta int
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_value int;
begin
  if counter_name not in (
    'randomize_credits',
    'extra_oracle_credits',
    'paid_beneficiary_slots'
  ) then
    raise exception 'invalid counter %', counter_name;
  end if;

  execute format(
    'update public.profiles set %I = greatest(0, coalesce(%I, 0) + $1) where id = $2 returning %I',
    counter_name, counter_name, counter_name
  )
  into new_value
  using delta, target_user_id;

  return new_value;
end;
$$;

revoke all on function public.increment_profile_counter(uuid, text, int) from public;
revoke all on function public.increment_profile_counter(uuid, text, int) from anon;
revoke all on function public.increment_profile_counter(uuid, text, int) from authenticated;
