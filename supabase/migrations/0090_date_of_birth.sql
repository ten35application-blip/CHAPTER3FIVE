-- 0090_date_of_birth
--
-- chapter3five is 18+. Until now the age gate was a single
-- self-attest checkbox at signup ("I'm 18 or older"). That's the
-- bare minimum many stores expect but it's trivially checked-and-
-- lied. Adding a real date-of-birth field so the signup form can
-- compute age and refuse creation for anyone <18.
--
-- Schema:
--   date_of_birth DATE  -- nullable so existing 4 accounts don't
--                          break; the signup action requires it for
--                          new sign-ups.
--   Column protection: date_of_birth goes in the
--   protect_billing_columns denylist so a user can't PATCH their
--   own DOB via the anon key after the fact. Legitimate writers are
--   the signup server action (admin client) and, later, an admin
--   correction tool. Users read it back but can't rewrite the age
--   they registered as.
--
-- Applied via mcp. Idempotent.

alter table public.profiles
  add column if not exists date_of_birth date null;

comment on column public.profiles.date_of_birth is
  'User-provided DOB captured at signup. 18+ enforced server-side; nullable for pre-0090 accounts.';

-- Extend the 0088 protect_billing_columns trigger to cover the new
-- column. Same shape: PostgREST roles blocked, service_role passes.
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
       or new.date_of_birth is not null then
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
  then
    raise exception 'profiles: billing / entitlement columns are not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
