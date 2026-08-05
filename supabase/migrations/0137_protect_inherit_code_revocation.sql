-- 0137_protect_inherit_code_revocation
--
-- A creator could un-revoke a code an admin revoked, from the browser.
--
-- The "inherit_codes: creator revokes own" RLS policy is a full UPDATE
-- scoped to created_by, and protect_inherit_code_columns (0068, role
-- check hardened in 0071) guards code / oracle_id / created_by /
-- created_at — but not revoked_at. So any creator could PATCH
-- /rest/v1/inherit_codes with {"revoked_at": null} using the anon key
-- that ships in every browser bundle, reversing a moderation revoke
-- made through the admin surface. The equivalent moderation column on
-- oracles (blocked_at) is trigger-protected; this one was the gap.
--
-- Since 985d70b, revocation is a code's ONLY kill switch — deletion
-- never kills one. That makes this column the single control on
-- whether a family's card works, which is exactly why it must be
-- one-way for user roles:
--
--   null -> timestamp   allowed  (the creator revoking their own code
--                                 is the legitimate purpose of the
--                                 RLS policy)
--   timestamp -> null   refused  (un-revoking requires the admin
--                                 surface, whose service-role client
--                                 bypasses this trigger — same posture
--                                 as oracle restore in 0117)
--   timestamp -> other  refused  (re-dating a revoke rewrites history)
--
-- Idempotent: create or replace under the existing trigger.

create or replace function public.protect_inherit_code_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon')
     and coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'inherit_codes: direct client inserts are not allowed'
      using errcode = '42501';
  end if;

  if new.code is distinct from old.code
    or new.oracle_id is distinct from old.oracle_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'inherit_codes: this column is not user-writable'
      using errcode = '42501';
  end if;

  -- revoked_at is one-way for PostgREST roles: setting it (revoking)
  -- is the creator's right; clearing or re-dating it is not.
  if old.revoked_at is not null
     and new.revoked_at is distinct from old.revoked_at then
    raise exception 'inherit_codes: a revoked code stays revoked — un-revoking requires the admin surface'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
