-- ============================================================================
-- 0067_tighten_oracles_and_helpers.sql
--
-- Applied to live DB via MCP. Committing so a fresh environment gets
-- the same shape via `supabase db push`.
--
-- Column-level protection on user-writable helper tables. Same pattern
-- as the profiles billing trigger (0065): mirror the row-scope from
-- the existing RLS policies but restrict which columns anon/authenticated
-- can actually change. service_role and postgres pass through so server
-- actions and admin tools work unchanged.
--
-- Rationale (kept generic — see internal notes for details): several
-- user-writable tables hold columns that the backend owns and the user
-- should not be able to overwrite from a direct PATCH.
--
-- Idempotent. Safe to run twice.
-- ============================================================================

create or replace function public.protect_oracle_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := current_setting('role', true);
begin
  if caller_role in ('service_role', 'postgres') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'oracles: direct client inserts are not allowed'
      using errcode = '42501';
  end if;

  -- User-writable columns (allow): is_starred, manually_unread,
  -- deleted_at, name, one_line_hook, updated_at. Everything else is
  -- backend-owned and must not change from a client PATCH.
  if new.persona_prompt is distinct from old.persona_prompt
    or new.traits is distinct from old.traits
    or new.fingerprint is distinct from old.fingerprint
    or new.blocked_at is distinct from old.blocked_at
    or new.block_reason is distinct from old.block_reason
    or new.avatar_url is distinct from old.avatar_url
    or new.avatar_hash is distinct from old.avatar_hash
    or new.face_generation_status is distinct from old.face_generation_status
    or new.face_generation_error is distinct from old.face_generation_error
    or new.is_legacy is distinct from old.is_legacy
    or new.creation_source is distinct from old.creation_source
    or new.significant_events is distinct from old.significant_events
    or new.legacy_answers is distinct from old.legacy_answers
    or new.created_by is distinct from old.created_by
    or new.user_id is distinct from old.user_id
  then
    raise exception 'oracles: this column is not user-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists oracles_protect_backend_columns on public.oracles;
create trigger oracles_protect_backend_columns
  before insert or update on public.oracles
  for each row execute function public.protect_oracle_columns();

-- persona_memories: writes are exclusively server-side. Drop the
-- user write paths (SELECT stays for context lookup).
drop policy if exists "persona_memories: user updates own" on public.persona_memories;
drop policy if exists "persona_memories: user inserts own" on public.persona_memories;
drop policy if exists "persona_memories: user deletes own" on public.persona_memories;

-- inherit_codes: user's legitimate update is revoking their own code
-- (setting revoked_at). Block direct client writes to the other
-- columns; service_role writes (mint) pass through.
create or replace function public.protect_inherit_code_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := current_setting('role', true);
begin
  if caller_role in ('service_role', 'postgres') then
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
  return new;
end;
$$;

drop trigger if exists inherit_codes_protect_columns on public.inherit_codes;
create trigger inherit_codes_protect_columns
  before insert or update on public.inherit_codes
  for each row execute function public.protect_inherit_code_columns();
