-- 0093_relax_oracle_state_deleted_at
--
-- Fable audit on batches A-F flagged: 0091's protect_oracle_state
-- denies user-role UPDATEs to deleted_at, but 0067's oracle-column
-- guard deliberately ALLOWLISTED deleted_at as user-writable so
-- the "delete this identity" UI works (soft-delete via user
-- client). 0091 was strictly stricter than 0067 on this column
-- and broke src/app/(gated)/dashboard/actions.ts softDeleteIdentity.
--
-- Fix: drop deleted_at from 0091's denylist. It's not a safety
-- column — clearing it (undelete) still requires blocked_at etc.
-- to remain protected; setting it (soft-delete) is a legitimate
-- user action. scheduled_purge_at stays protected — that's set by
-- the delete action's server code (via admin) and shouldn't be
-- user-editable.
--
-- Idempotent.

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
    return new;
  end if;

  -- deleted_at intentionally omitted from the UPDATE denylist —
  -- user-side soft-delete of an identity legitimately writes it.
  if new.blocked_at is distinct from old.blocked_at
    or new.block_reason is distinct from old.block_reason
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
