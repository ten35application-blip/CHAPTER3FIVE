-- 0102_fix_signup_oracle_guard
--
-- Corrective migration: signups have been failing with a 500 from
-- Supabase Auth. Auth logs show every POST /signup dying on:
--
--   ERROR: oracles: direct client inserts are not allowed (SQLSTATE 42501)
--
-- Root cause: 0094/0096 redefined protect_oracle_columns with an
-- ALLOWLIST trust check —
--
--   caller_role in ('service_role', 'postgres', 'supabase_admin')
--   or session_user = 'postgres'
--
-- GoTrue (Supabase Auth) connects to Postgres as its own login role
-- `supabase_auth_admin` and never issues SET ROLE, so inside the
-- trigger the role GUC reads 'none' and session_user is
-- 'supabase_auth_admin'. Neither matches the allowlist, so when
-- handle_new_user (fired by the auth.users insert) creates the
-- user's placeholder oracle, the guard rejects it, the whole signup
-- transaction aborts, and Auth returns unexpected_failure → the
-- client shows "Something went wrong."
--
-- Fix: restore the 0088 pattern used by every other guard in this
-- lineage (protect_billing_columns, protect_oracle_state,
-- protect_beneficiary_state, protect_group_room_state): identify
-- the CLIENT roles instead of enumerating server roles. PostgREST
-- always runs requests under SET ROLE 'authenticated' / 'anon', so
-- those two names in the role GUC are the complete client surface.
-- Anything else — service_role, postgres, supabase_admin,
-- supabase_auth_admin (GoTrue), background workers — is server-side
-- and trusted. Protection for user requests is unchanged: a
-- PostgREST call can never reach this trigger without the role GUC
-- set to 'authenticated' or 'anon'.
--
-- Denylist body is identical to 0096 (is_concierge included).
--
-- Idempotent. Safe to run twice.

create or replace function public.protect_oracle_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- current_setting('role', true) returns the SET ROLE PostgREST
  -- applies per request ('authenticated' or 'anon'). For direct
  -- connections (GoTrue, migrations, workers) it is 'none' or
  -- unset; fall back to session_user for completeness.
  role_name text := coalesce(
    current_setting('role', true),
    session_user::text
  );
begin
  if role_name not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'oracles: direct client inserts are not allowed'
      using errcode = '42501';
  end if;

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
    or new.disclosure_pace is distinct from old.disclosure_pace
    or new.silence_style is distinct from old.silence_style
    or new.punctuation_habit is distinct from old.punctuation_habit
    or new.memory_style is distinct from old.memory_style
    or new.text_burst_style is distinct from old.text_burst_style
    or new.voice_examples is distinct from old.voice_examples
    or new.chronotype is distinct from old.chronotype
    or new.texting_fluency is distinct from old.texting_fluency
    or new.pet_name is distinct from old.pet_name
    or new.is_concierge is distinct from old.is_concierge
  then
    raise exception 'oracles: this column is not user-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
