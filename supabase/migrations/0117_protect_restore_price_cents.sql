-- 0117_protect_restore_price_cents
--
-- Fable audit C2: oracles.restore_price_cents (added in 0074) was
-- absent from every column-protection trigger, so an authenticated
-- user could PATCH their own oracle row to `restore_price_cents=50`
-- and the /api/billing/restore-identity route would charge $0.50
-- for a $5 restore because it read the DB column verbatim.
--
-- The route is fixed in the same push to derive the price from
-- PRICING.restoreIdentityCents and ignore the column entirely --
-- that closes the exploit for the restore flow. This migration is
-- the defense-in-depth layer: even if a future caller reads the
-- column again, PostgREST-role writes to it are blocked.
--
-- Also adds a directional guard on deleted_at (Fable H1): 0093
-- relaxed the denylist so softDeleteIdentity could write it via
-- the user client, but that equally lets a user set it BACK to
-- null and skip the $5 restore paywall. We now allow null->timestamp
-- (the soft-delete direction) but block timestamp->null (the paid
-- restore path, which must go via the admin client in the webhook
-- or the legacy free-restore branch).
--
-- Idempotent. Safe to run twice.

create or replace function public.protect_oracle_state()
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
    if new.blocked_at is not null
       or new.block_reason is not null
       or new.deleted_at is not null
       or new.scheduled_purge_at is not null
       or coalesce(new.is_legacy, false) = true
       or new.creation_source is not null then
      raise exception 'oracles: state columns are not user-writable'
        using errcode = '42501';
    end if;
    -- restore_price_cents may be set on INSERT (defaults to 500 via
    -- the column default in 0074; app code doesn't override), but a
    -- user-forged non-default value on INSERT would still be a
    -- pricing attack. Block any non-default insert value.
    if new.restore_price_cents is distinct from 500 then
      raise exception 'oracles: restore_price_cents is not user-writable'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.blocked_at is distinct from old.blocked_at
    or new.block_reason is distinct from old.block_reason
    or new.scheduled_purge_at is distinct from old.scheduled_purge_at
    or new.is_legacy is distinct from old.is_legacy
    or new.creation_source is distinct from old.creation_source
    or new.fingerprint is distinct from old.fingerprint
    or new.user_id is distinct from old.user_id
    or new.restore_price_cents is distinct from old.restore_price_cents
  then
    raise exception 'oracles: state columns are not user-writable'
      using errcode = '42501';
  end if;

  -- Directional guard on deleted_at: null -> timestamp is allowed
  -- (that's how softDeleteIdentity works via the user client, per
  -- 0093's intent). timestamp -> null is the RESTORE direction and
  -- must never come through a PostgREST-role write -- the paid
  -- restore path in /api/stripe/webhook uses createAdminClient()
  -- which bypasses this trigger, and the free legacy-restore
  -- branch in /api/billing/restore-identity does the same.
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'oracles: restoring a deleted identity requires the paid webhook path'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Trigger already exists from 0091; the create-or-replace above
-- swaps the function body under it. No trigger drop/create needed.

-- Backfill: reset any pre-fix tampered rows so the DB matches the
-- server-derived price the /api/billing/restore-identity route now
-- charges. Without this, HubSheet.tsx's display would show e.g.
-- $0.50 for a tampered row while checkout charges $5 — a jarring
-- mismatch even after the exploit itself is closed. Idempotent.
update public.oracles
   set restore_price_cents = 500
 where restore_price_cents is distinct from 500;
