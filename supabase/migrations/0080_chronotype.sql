-- 0080_chronotype
--
-- Fable humanization #1: latency variance. Adds a per-identity
-- chronotype rolled at synthesis. The stream route uses it (with mood
-- and hour-of-day) to compute a small pre-stream delay so the typing
-- indicator sits for a moment before Claude starts — the "read your
-- text, think, start typing" beat every real friend has.
--
-- Nullable — probabilistically rolled (some personas are just even-
-- keeled). Existing rows read null = no chronotype signal, delay
-- falls back to baseline.

alter table public.oracles
  add column if not exists chronotype text
    check (chronotype is null or chronotype in
      ('morning_person', 'night_owl', 'steady'));

comment on column public.oracles.chronotype is
  'Fable humanization: time-of-day disposition; null=baseline';

-- Extend the oracles column-protection trigger to cover this new
-- column. Same pattern as 0079 — trigger is a denylist so new
-- columns default to user-mutable unless named. Replace function
-- body only; trigger itself doesn't move.
create or replace function public.protect_oracle_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon')
     and coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
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
  then
    raise exception 'oracles: this column is not user-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
