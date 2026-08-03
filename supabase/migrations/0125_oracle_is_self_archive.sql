-- ============================================================
-- oracles.is_self_archive
-- ============================================================
-- Marks a "Me" identity — the user's self-archive created via the
-- legacy walk with subject.mode='self'. Wilson's Phase-2 spec:
-- "Me is a separate free slot on all tiers — does NOT eat plan
-- quota." canCreateOracle counts every non-concierge / non-inherited
-- / non-deleted oracle against the plan; without a marker column
-- there's no reliable way to exclude the Me row without accidentally
-- excluding "for someone you love" legacy identities (which SHOULD
-- count, they're companions the user made for another person).
--
-- Nullable-default-false so existing rows have a well-defined value.
-- Written by the legacy complete route when subject.mode==='self'.
-- Read by canCreateOracle to skip the row from the quota tally.
--
-- Wilson flagged approval 2026-08-03 (option A over the wider
-- is_legacy=false filter which would also exclude other-mode legacy).

alter table public.oracles
  add column if not exists is_self_archive boolean not null default false;

-- Backfill: any existing owner-authored legacy oracle whose
-- legacy_answers.subject.mode is 'self' is a Me — mark it so those
-- users don't keep paying quota for a slot Wilson said was free.
-- Filter to `inherited_at is null` so we never touch a redeemed
-- inherit copy (which is owned + is_legacy=true per 0111 but was
-- explicitly purchased and should stay counted — actually, inherited
-- copies are already excluded from canCreateOracle at the row-count
-- SELECT via `inherited_at is null`, so the flag on them is a no-op
-- semantically; still safest to only flip the flag where it's true).
update public.oracles
set is_self_archive = true
where is_legacy = true
  and inherited_at is null
  and (legacy_answers -> 'subject' ->> 'mode') = 'self'
  and is_self_archive = false;

-- Extend protect_oracle_columns denylist (0102) so a crafted PATCH
-- can't flip is_self_archive=true on an existing companion oracle to
-- exempt it from quota and unlock a free slot. All legitimate writes
-- come from the legacy complete route via admin/service-role, which
-- bypasses this trigger.
create or replace function public.protect_oracle_columns()
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
    or new.is_self_archive is distinct from old.is_self_archive
  then
    raise exception 'oracles: this column is not user-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
