-- 0091_protect_oracle_state
--
-- Fable audit surfaced: `oracles` UPDATE policy has no column
-- allowlist (0002_multi_oracle.sql), so a user holding the anon
-- key can PATCH their own oracle row and clear a persona safety
-- block (blocked_at = null, block_reason = null) that was set
-- because of abusive behavior. Reading the block is enforced in
-- src/app/api/chat/[id]/stream/route.ts and the chat page, but
-- the unblock path was open. Same shape on `beneficiaries` and
-- `group_rooms`.
--
-- This migration adds a protect_oracle_state trigger that mirrors
-- protect_billing_columns (0088): PostgREST-role writes are
-- blocked from mutating the safety / lifecycle / audit columns,
-- while service-role writes pass through. Users can still edit
-- the columns they legitimately own (name, avatar, memory hooks,
-- humanization traits, etc. — those already have their own guards
-- in 0079).
--
-- Columns policed on oracles:
--   blocked_at, block_reason    — safety block state
--   deleted_at, scheduled_purge_at — soft-delete lifecycle
--   is_legacy                    — plan/behavior mode
--   creation_source              — audit trail for how the row was made
--   fingerprint                  — uniqueness key
--   user_id                      — ownership (belt-and-suspenders)
--
-- Similar protection on beneficiaries (status, notified_at,
-- activated_at, claimed_at, claimed_user_id, claim_token,
-- owner_user_id) and group_rooms (deleted_at, owner_user_id).
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
    -- Only truly server-side fields get blocked on INSERT from a
    -- PostgREST role. fingerprint is intentionally allowed because
    -- src/app/(gated)/identity/new/actions.ts computes it client-
    -- side and relies on the unique index for collision safety —
    -- a user-forged fingerprint can only collide with an existing
    -- row and get rejected, no privilege gain. is_legacy is admin-
    -- only (legacy flow uses createAdminClient); creation_source is
    -- an audit column the app populates via admin paths too.
    if new.blocked_at is not null
       or new.block_reason is not null
       or new.deleted_at is not null
       or new.scheduled_purge_at is not null
       or coalesce(new.is_legacy, false) = true
       or new.creation_source is not null then
      raise exception 'oracles: state columns are not user-writable'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.blocked_at is distinct from old.blocked_at
    or new.block_reason is distinct from old.block_reason
    or new.deleted_at is distinct from old.deleted_at
    or new.scheduled_purge_at is distinct from old.scheduled_purge_at
    or new.is_legacy is distinct from old.is_legacy
    or new.creation_source is distinct from old.creation_source
    or new.fingerprint is distinct from old.fingerprint
    or new.user_id is distinct from old.user_id
  then
    raise exception 'oracles: state columns are not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists oracles_protect_state on public.oracles;
create trigger oracles_protect_state
  before insert or update on public.oracles
  for each row execute function public.protect_oracle_state();

-- beneficiaries: designation + claim lifecycle is server-side only.
-- The server-side flow at 0052_beneficiary_atomic_add mints the
-- claim_token and 0075/passing crons transition status. A user
-- PATCHing claim_token or claimed_user_id would hijack someone
-- else's redemption.
create or replace function public.protect_beneficiary_state()
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
    if new.claim_token is not null
       or new.notified_at is not null
       or new.activated_at is not null
       or new.claimed_at is not null
       or new.claimed_user_id is not null
       or coalesce(new.status, 'designated') <> 'designated' then
      raise exception 'beneficiaries: lifecycle columns are not user-writable'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.claim_token is distinct from old.claim_token
    or new.notified_at is distinct from old.notified_at
    or new.activated_at is distinct from old.activated_at
    or new.claimed_at is distinct from old.claimed_at
    or new.claimed_user_id is distinct from old.claimed_user_id
    or new.status is distinct from old.status
    or new.owner_user_id is distinct from old.owner_user_id
  then
    raise exception 'beneficiaries: lifecycle columns are not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists beneficiaries_protect_state on public.beneficiaries;
create trigger beneficiaries_protect_state
  before insert or update on public.beneficiaries
  for each row execute function public.protect_beneficiary_state();

-- group_rooms: only owner_user_id needs protection (no deleted_at
-- column on this table; rows are hard-deleted by the owner via the
-- ownership policy). Guarding owner_user_id from re-assignment
-- prevents "steal a room by patching owner_user_id".
create or replace function public.protect_group_room_state()
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

  if tg_op = 'UPDATE'
    and new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'group_rooms: owner is not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists group_rooms_protect_state on public.group_rooms;
create trigger group_rooms_protect_state
  before insert or update on public.group_rooms
  for each row execute function public.protect_group_room_state();
