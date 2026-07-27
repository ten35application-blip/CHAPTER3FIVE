-- 0084_restore_billing_trigger
--
-- Corrective migration. The previous migration (0083) used
-- `create or replace function public.protect_billing_columns()`
-- rebuilding the function body from the older 0065 shape rather
-- than 0073's current shape. That silently dropped the guards
-- 0072 (trial_ends_at + free_identity_id) and 0073
-- (extra_inherited_slots) had added, and also wiped 0066's
-- `set search_path = public` pin.
--
-- Rebuilding the function here from 0073's canonical body, plus
-- the five subscription-mirror columns 0083 introduced
-- (stripe_customer_id, stripe_subscription_id, current_period_end,
-- cancel_at_period_end, subscription_status). Preserves the
-- 0073 caller check (role-based passthrough for service_role /
-- postgres / supabase_admin) and re-pins search_path.
--
-- Applied via mcp on same day as 0083 to close the window.
-- Idempotent (CREATE OR REPLACE).

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
  then
    raise exception 'profiles: billing / entitlement columns are not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
