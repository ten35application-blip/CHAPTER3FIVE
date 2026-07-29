-- 0118_close_profiles_column_regrant
--
-- Fable full-audit M1: migration 0116 (profiles column allowlist)
-- re-granted INSERT/UPDATE on four server-only columns to the
-- `authenticated` role:
--
--   randomize_credits, randomize_count  -- server-managed onboarding
--                                           credits + counter
--   last_active_at                      -- server-managed heartbeat
--   deleted_at                          -- soft-delete lifecycle
--
-- Neither the 0113 protect_billing_columns trigger nor any other
-- guard covered these columns. Consequences:
--
--   * Any authenticated user could PATCH randomize_credits=999 on
--     their own row and clear the 402 gate in
--     src/app/api/onboarding/randomize/route.ts:60-65 -- unlimited
--     free randomizes.
--   * A user could self-clear profiles.deleted_at during the 30-day
--     grace window and un-hide a deleting account.
--   * A user could forge last_active_at to game analytics / churn
--     scoring (minor, but same permission hole).
--
-- Two-layer fix:
--   1. REVOKE the accidental INSERT+UPDATE grants on the four
--      columns from `authenticated`.
--   2. Extend protect_billing_columns to reject writes to
--      randomize_credits, randomize_count, last_active_at, and
--      add a DIRECTIONAL guard on deleted_at (null->timestamp is
--      allowed so /(gated)/settings/delete/actions.ts can still
--      soft-delete via the user client; timestamp->null is server-
--      only via admin restore paths).
--
-- The randomize route is updated in the same push to use
-- createAdminClient() for the credits/count update; that's the
-- ONE legitimate PostgREST-role writer of these columns that we're
-- deliberately breaking, and switching it to admin restores the
-- flow without opening the hole.
--
-- Idempotent. Safe to run twice.

-- Layer 1: REVOKE the accidental grants. Idempotent (revoking a
-- grant that doesn't exist is a no-op).
revoke insert (randomize_credits, randomize_count, last_active_at)
  on public.profiles from authenticated;
revoke update (randomize_credits, randomize_count, last_active_at)
  on public.profiles from authenticated;

-- deleted_at stays granted so the soft-delete direction keeps
-- working through the user client (matches how oracles' deleted_at
-- was handled in 0117 for the H1 fix).

-- Layer 2: extend protect_billing_columns to cover the four flagged
-- columns. Belt-and-suspenders against a future grant that slips
-- through review.
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
    -- New rows created by the user must never carry pre-set values
    -- for these columns. The signup trigger and admin paths set
    -- them via service_role, which bypasses this function above.
    if new.randomize_credits is not null and new.randomize_credits <> 0
       or new.randomize_count is not null and new.randomize_count <> 0
       or new.last_active_at is not null
       or new.deleted_at is not null then
      raise exception 'profiles: server-managed columns are not user-writable on insert'
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
    or new.randomize_credits is distinct from old.randomize_credits
    or new.randomize_count is distinct from old.randomize_count
    or new.last_active_at is distinct from old.last_active_at
  then
    raise exception 'profiles: billing / entitlement columns are not user-writable'
      using errcode = '42501';
  end if;

  -- deleted_at: directional guard. Matches the 0117 pattern on
  -- oracles. null -> timestamp is the user-side soft-delete path
  -- (settings/delete/actions.ts) and stays allowed. timestamp ->
  -- null is the restore direction, which must come from an admin
  -- path (support ticket / admin console). Also blocks
  -- timestamp -> different-timestamp so someone can't drift their
  -- deletion clock back.
  if old.deleted_at is not null and new.deleted_at is not null
     and new.deleted_at is distinct from old.deleted_at then
    raise exception 'profiles: cannot re-timestamp a delete'
      using errcode = '42501';
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'profiles: restoring a deleted account requires the admin path'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Trigger already exists from 0090; the create-or-replace above
-- swaps the function body under it. No trigger drop/create needed.

-- Backfill: no data change required. Any pre-fix tampered values
-- (randomize_credits=999) are self-corrected once the user
-- consumes credits or hits the 402 gate -- the webhook is the only
-- writer that increases them from here, and the randomize route
-- (fixed to admin) decrements them on legitimate use.
