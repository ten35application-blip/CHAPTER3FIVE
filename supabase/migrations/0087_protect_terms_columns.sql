-- 0087_protect_terms_columns
--
-- Fable audit on a561c2a flagged: profiles.terms_version_accepted +
-- terms_accepted_at are user-writable via the 0001 owner-UPDATE
-- policy (no column allowlist), and the 0065/0084 billing-column
-- trigger only polices billing/entitlement fields. A mobile client
-- can PATCH terms_version_accepted directly to satisfy the (gated)
-- layout AND the new API gate (requireTermsAccepted) WITHOUT ever
-- seeing the acceptance page or writing a ledger row.
--
-- Fix: extend the 0084 protect_billing_columns trigger to reject
-- authenticated/anon writes to terms_accepted_at and
-- terms_version_accepted. The onboarding accept action switches to
-- the admin client on the same commit so the legitimate path still
-- works.
--
-- Idempotent. Safe to run twice.

create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller text := current_user::text;
begin
  if caller in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  if new.pro_until is distinct from old.pro_until
    or new.plan_source is distinct from old.plan_source
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.free_identity_id is distinct from old.free_identity_id
    or new.extra_inherited_slots is distinct from old.extra_inherited_slots
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.current_period_end is distinct from old.current_period_end
    or new.cancel_at_period_end is distinct from old.cancel_at_period_end
    or new.subscription_status is distinct from old.subscription_status
    or new.terms_accepted_at is distinct from old.terms_accepted_at
    or new.terms_version_accepted is distinct from old.terms_version_accepted
  then
    raise exception 'profiles: billing / entitlement columns are not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
