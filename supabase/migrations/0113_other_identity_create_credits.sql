-- 0113_other_identity_create_credits
--
-- July 2026 legacy-mint gate: minting an OTHER-mode legacy identity
-- ("For someone I love") becomes a one-time $5 purchase at Finish time
-- (Stripe purpose 'other_identity_create'). Self-mode stays free; the
-- recipient-redeem gate (0107, inherited_slot_purchase) is untouched.
--
-- profiles.other_identity_credits — INTEGER, not null, default 0. A
-- running balance of purchased-but-unused other-mode mint credits,
-- exactly parallel to inherited_slot_credits (0107): the Stripe
-- webhook increments it by 1 per completed purchase, the
-- completeLegacyIdentity action decrements it by 1 after a successful
-- synthesis + insert, and a refund decrements it back. Same "balance
-- column, not ledger table" reasoning — the payments table already
-- records every purchase for reconciliation, and greatest(0, ...) in
-- increment_profile_counter floors a losing race at zero.
--
-- The new column joins the protect_billing_columns denylist (users
-- must never write it; the webhook + completion action go through the
-- service role) and the increment_profile_counter allowlist (atomic
-- grant/consume through the same race-safe primitive as pack credits).
-- profiles carries table-wide SELECT grants (see 0075 note), so no
-- extra column grant is needed for reads; the trigger is the write
-- gate.
--
-- Idempotent. Applied via mcp.

alter table public.profiles
  add column if not exists other_identity_credits integer not null default 0;

comment on column public.profiles.other_identity_credits is
  'Running balance of purchased other-mode legacy-mint credits ($5 one-time per other-mode legacy identity completed). Incremented by the Stripe webhook on purchase; decremented one per successful other-mode completion. Never user-writable.';

-- Extend the 0090/0106/0107 protect_billing_columns trigger to cover
-- the new column. Same shape: PostgREST roles (authenticated/anon) are
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
       or coalesce(new.image_credits, 0) <> 0
       or coalesce(new.inherited_slot_credits, 0) <> 0
       or coalesce(new.other_identity_credits, 0) <> 0 then
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
    or new.inherited_slot_credits is distinct from old.inherited_slot_credits
    or new.other_identity_credits is distinct from old.other_identity_credits
  then
    raise exception 'profiles: billing / entitlement columns are not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Extend the 0017/0106/0107 atomic counter RPC's allowlist so the
-- webhook can grant other-mode mint credits (delta = +1) and the
-- completion action can consume them (delta = -1) through the same
-- race-safe primitive.
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
    'image_credits',
    'inherited_slot_credits',
    'other_identity_credits'
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
