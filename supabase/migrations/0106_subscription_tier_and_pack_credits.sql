-- 0106_subscription_tier_and_pack_credits
--
-- Stripe wiring for the three-tier + packs rework (ef0e824). Two
-- concerns land together because the webhook writes both:
--
-- 1. profiles.subscription_tier — TEXT, nullable, 'basic' | 'pro'.
--    NULL = no active Stripe subscription (Free tier, admin grant,
--    or legacy trial — those resolve through pro_until/trial_ends_at
--    exactly as before). The Stripe webhook sets it when a
--    subscription lands or updates (matched by Price ID against
--    STRIPE_PRICE_ID_BASIC_MONTHLY / STRIPE_PRICE_ID_PRO_MONTHLY)
--    and clears it when the subscription dies at end-of-period
--    (customer.subscription.deleted). getPlanTier() reads it to
--    split Basic from Pro; pro_until stays the "is any paid window
--    active" clock it has always been.
--
-- 2. profiles.message_credits / profiles.image_credits — INTEGER,
--    not null, default 0. Running balances of unused add-on pack
--    credits (Small/Medium/Large one-time top-ups; each pack is
--    messages OR images, buyer's pick at checkout).
--
--    WHY RUNNING BALANCES, NOT A LEDGER TABLE: packs are one-off
--    top-ups with no expiration, no partial refunds after use, and
--    no per-line audit requirement — the payments table already
--    records every purchase (amount, purpose, Stripe ids) for
--    reconciliation. A rows-per-pack ledger would force every cap
--    check in canSendMessageForTierCap to SUM open lines on every
--    send; a single balance column is one indexed read and one
--    atomic increment/decrement via increment_profile_counter.
--    Worst-case race (two concurrent sends both seeing balance=1)
--    costs one un-paid-for message — acceptable rounding, per
--    Wilson. greatest(0, ...) in the counter fn floors at zero.
--
-- All three columns join the protect_billing_columns denylist:
-- users must NEVER write them directly (anon/authenticated writes
-- rejected); the Stripe webhook (service role) is the only writer.
--
-- Idempotent. Applied via mcp.

alter table public.profiles
  add column if not exists subscription_tier text null
    check (subscription_tier in ('basic', 'pro')),
  add column if not exists message_credits integer not null default 0,
  add column if not exists image_credits integer not null default 0;

comment on column public.profiles.subscription_tier is
  'Active Stripe subscription tier: basic | pro. NULL = no active subscription (Free, admin grant, or trial). Written only by the Stripe webhook.';
comment on column public.profiles.message_credits is
  'Running balance of unused add-on pack MESSAGE credits. Incremented by the Stripe webhook on pack purchase; decremented one per over-cap send. Never user-writable.';
comment on column public.profiles.image_credits is
  'Running balance of unused add-on pack IMAGE credits. Incremented by the Stripe webhook on pack purchase; decremented one per over-cap image send. Never user-writable.';

-- Extend the 0090 protect_billing_columns trigger to cover the three
-- new columns. Same shape: PostgREST roles (authenticated/anon) are
-- blocked from writing any denylisted column; service_role passes.
create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text := coalesce(
    current_setting('role', true),
    session_user::text
  );
begin
  if role_name not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.pro_until is not null
       or coalesce(new.plan_source, 'none') <> 'none'
       or coalesce(new.extra_oracle_credits, 0) <> 0
       or coalesce(new.extra_inherited_slots, 0) <> 0
       or new.trial_ends_at is not null
       or new.free_identity_id is not null
       or new.stripe_customer_id is not null
       or new.stripe_subscription_id is not null
       or new.current_period_end is not null
       or new.cancel_at_period_end is not null
       or new.subscription_status is not null
       or new.terms_accepted_at is not null
       or new.terms_version_accepted is not null
       or new.date_of_birth is not null
       or new.subscription_tier is not null
       or coalesce(new.message_credits, 0) <> 0
       or coalesce(new.image_credits, 0) <> 0 then
      raise exception 'profiles: billing / entitlement columns are not user-writable'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.pro_until is distinct from old.pro_until
    or new.plan_source is distinct from old.plan_source
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.free_identity_id is distinct from old.free_identity_id
    or new.extra_oracle_credits is distinct from old.extra_oracle_credits
    or new.extra_inherited_slots is distinct from old.extra_inherited_slots
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.current_period_end is distinct from old.current_period_end
    or new.cancel_at_period_end is distinct from old.cancel_at_period_end
    or new.subscription_status is distinct from old.subscription_status
    or new.terms_accepted_at is distinct from old.terms_accepted_at
    or new.terms_version_accepted is distinct from old.terms_version_accepted
    or new.date_of_birth is distinct from old.date_of_birth
    or new.subscription_tier is distinct from old.subscription_tier
    or new.message_credits is distinct from old.message_credits
    or new.image_credits is distinct from old.image_credits
  then
    raise exception 'profiles: billing / entitlement columns are not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Extend the 0017 atomic counter RPC's allowlist so the webhook can
-- grant pack credits (delta = +pack size) and the send paths can
-- consume them (delta = -1) through the same race-safe primitive.
-- greatest(0, ...) keeps a losing race from driving a balance
-- negative — the floor IS the accepted rounding model.
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
    'paid_beneficiary_slots',
    'message_credits',
    'image_credits'
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
