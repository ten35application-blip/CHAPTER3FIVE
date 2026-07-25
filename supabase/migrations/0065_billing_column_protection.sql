-- ============================================================================
-- 0065_billing_column_protection.sql
--
-- Applied to live DB via MCP on 2026-07-25 (legacy-pro-gate audit).
-- Committing the file so a fresh environment gets the same shape.
--
-- Closes two Pro-gate bypasses found in the audit:
--
-- 1. profiles billing columns were user-writable.
--    0001's "users can update their own profile" policy has no column
--    restriction, so any signed-in user could PATCH their own row via
--    the public anon key and set pro_until = '2099-01-01' — free Pro
--    forever. The trigger below rejects any INSERT/UPDATE from the
--    anon/authenticated roles that touches pro_until, plan_source, or
--    extra_oracle_credits. Server-side writers are unaffected:
--      - admin grant tool + Stripe webhook use the service-role client
--        (current_user = 'service_role'),
--      - increment_profile_counter() is SECURITY DEFINER owned by
--        postgres (current_user = 'postgres' inside it) and its EXECUTE
--        is already revoked from anon/authenticated (0017).
--
-- 2. inherit_codes were user-mintable.
--    "creator inserts for own oracle" let any authenticated user who
--    owns an is_legacy oracle insert codes directly from the browser —
--    and the oracles insert policy lets anyone insert an is_legacy row,
--    so a free user could hand-craft a legacy oracle and mint a real,
--    redeemable inherit code without ever passing the Pro gate.
--    Minting is the Pro feature. Dropping the insert policy makes the
--    Pro-gated server actions (which now mint via the service-role
--    client) the ONLY way a code comes to exist — the same pattern
--    oracle_shares already uses for redemption. Creator read/revoke
--    policies are untouched.
--
-- Idempotent. Safe to run twice.
-- ============================================================================

-- ── 1 · billing columns are server-side only ────────────────────────────────

create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
as $$
begin
  -- Only police the PostgREST user roles. service_role, postgres, and
  -- security-definer functions owned by postgres all pass through.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- The defensive insert in the (gated) layout sends only { id }, so
    -- defaults apply. Reject any user insert that tries to smuggle
    -- non-default billing values in.
    if new.pro_until is not null
       or coalesce(new.plan_source, 'none') <> 'none'
       or coalesce(new.extra_oracle_credits, 0) <> 0 then
      raise exception 'billing columns can only be set server-side';
    end if;
  else
    if new.pro_until is distinct from old.pro_until
       or new.plan_source is distinct from old.plan_source
       or new.extra_oracle_credits is distinct from old.extra_oracle_credits then
      raise exception 'billing columns can only be changed server-side';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_billing on public.profiles;
create trigger profiles_protect_billing
  before insert or update on public.profiles
  for each row execute function public.protect_billing_columns();

-- ── 2 · minting inherit codes is server-side only ───────────────────────────

drop policy if exists "inherit_codes: creator inserts for own oracle"
  on public.inherit_codes;
