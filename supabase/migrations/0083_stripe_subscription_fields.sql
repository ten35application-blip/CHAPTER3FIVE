-- 0083_stripe_subscription_fields
--
-- Stripe recurring wiring. Batch 1 of the store/play/stripe
-- application-prep sweep. Ships the columns + guards even though
-- STRIPE_PRICE_ID_PRO_MONTHLY is not set yet — the wiring is behind
-- that env flag on the app side, and the DB is safe either way.
--
-- Columns added to profiles:
--   stripe_customer_id       — set on first checkout (mode=subscription).
--                              Nullable forever for users who never pay.
--   stripe_subscription_id   — the active subscription row. Nullable when
--                              a user has never subscribed OR has fully
--                              cancelled + let the period lapse.
--   current_period_end       — mirror of subscription.current_period_end.
--                              We keep pro_until as the single source of
--                              truth for "is this user Pro right now", so
--                              this column is informational for support
--                              tooling / admin readout.
--   cancel_at_period_end     — subscription.cancel_at_period_end. Used by
--                              /settings to render "cancels on X" rather
--                              than "renews on X" for users who've
--                              cancelled but are still in-period.
--   subscription_status      — subscription.status verbatim (active,
--                              past_due, canceled, unpaid, trialing, etc).
--                              Text-typed, no CHECK — Stripe adds new
--                              statuses periodically and we don't want a
--                              webhook to fail on an unexpected string.
--
-- Column guards: all five are added to the existing billing denylist
-- (0065). Same rationale — user-writable would let a free user set
-- stripe_subscription_id = 'sub_valid' and short-circuit downstream
-- support tooling that trusts the column.
--
-- Idempotent. Safe to run twice.

alter table public.profiles
  add column if not exists stripe_customer_id text null,
  add column if not exists stripe_subscription_id text null,
  add column if not exists current_period_end timestamptz null,
  add column if not exists cancel_at_period_end boolean null,
  add column if not exists subscription_status text null;

comment on column public.profiles.stripe_customer_id is
  'Stripe customer id, set on first pro_monthly checkout. Reused for portal + future purchases.';
comment on column public.profiles.stripe_subscription_id is
  'Currently-tracked subscription id. Null once fully cancelled + lapsed.';
comment on column public.profiles.current_period_end is
  'Mirror of subscription.current_period_end. pro_until is authoritative.';
comment on column public.profiles.cancel_at_period_end is
  'Whether the user has cancelled — subscription runs to current_period_end then stops.';
comment on column public.profiles.subscription_status is
  'Stripe subscription.status verbatim. Text (not enum) so new statuses do not break webhook writes.';

-- Fast lookup on customer id (webhook reverse-lookup) and on subscription id.
create unique index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;
create unique index if not exists profiles_stripe_subscription_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Extend the 0065 billing denylist to cover the new columns. If a
-- misconfigured RLS policy ever allowed authenticated writes, this
-- trigger still refuses them.
create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.pro_until is not null
       or coalesce(new.plan_source, 'none') <> 'none'
       or coalesce(new.extra_oracle_credits, 0) <> 0
       or new.stripe_customer_id is not null
       or new.stripe_subscription_id is not null
       or new.current_period_end is not null
       or new.cancel_at_period_end is not null
       or new.subscription_status is not null then
      raise exception 'billing columns can only be set server-side';
    end if;
  else
    if new.pro_until is distinct from old.pro_until
       or new.plan_source is distinct from old.plan_source
       or new.extra_oracle_credits is distinct from old.extra_oracle_credits
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.current_period_end is distinct from old.current_period_end
       or new.cancel_at_period_end is distinct from old.cancel_at_period_end
       or new.subscription_status is distinct from old.subscription_status then
      raise exception 'billing columns can only be changed server-side';
    end if;
  end if;

  return new;
end;
$$;
