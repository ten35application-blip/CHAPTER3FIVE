-- 0088_fix_definer_role_check
--
-- Corrective migration. protect_billing_columns was declared
-- SECURITY DEFINER (0072 + 0073 + 0087), which means inside the
-- function body `current_user` is always the function OWNER
-- (postgres) — not the JWT role of the caller. The role guard in
-- 0065 / 0084 / 0087 was therefore short-circuiting for every
-- caller regardless of who they were, leaving the entire billing +
-- entitlement column set writable from any authenticated PostgREST
-- session.
--
-- Verified separately that no exploit landed during the window
-- (no unexpected pro_until / plan_source / stripe_* / terms_*
-- values on any profile).
--
-- Correct pattern: PostgREST uses SET LOCAL role = 'authenticated'
-- (or 'anon') before running the query, and that role is visible
-- via current_setting('role', true). Fall back to session_user for
-- non-PostgREST callers.
--
-- Also: keep the function SECURITY DEFINER so it can run for a
-- caller who lacks direct trigger-firing privileges on the table,
-- but pin the search path and detect the true caller via the role
-- GUC.
--
-- Idempotent. Safe to run twice.

create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- current_setting('role', true) returns the SET ROLE PostgREST
  -- applies for each request ('authenticated' or 'anon'). Falls back
  -- to session_user for background workers and superuser sessions.
  role_name text := coalesce(
    current_setting('role', true),
    session_user::text
  );
begin
  -- Anything that is not a PostgREST-scoped role gets to write freely:
  -- service_role, postgres, supabase_admin, background workers, etc.
  if role_name not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Any INSERT from a PostgREST role that tries to smuggle billing
    -- or entitlement values in gets rejected; the legitimate
    -- (gated)/layout insert only sends { id }.
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
       or new.terms_version_accepted is not null then
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
  then
    raise exception 'profiles: billing / entitlement columns are not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
