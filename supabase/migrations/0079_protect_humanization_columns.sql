-- 0079_protect_humanization_columns
--
-- Extend the oracles column-protection trigger from 0068 to cover the
-- six humanization columns added in 0078. The trigger is a DENYLIST
-- (columns named here throw 42501 on user UPDATE); new columns default
-- to user-mutable, which is not what we want for formula-derived
-- traits.
--
-- Impact today: nothing reads these six at chat time (persona_prompt
-- is pre-baked). But Phase B multi-message replies will read
-- text_burst_style to shape rhythm, and once that ships a user could
-- PATCH their own oracle's burst style to whatever they liked. This
-- pre-empts that class of hole.
--
-- Note the SAME pattern used in 0068 — we do NOT recreate the trigger,
-- only replace the function body so the guard block acquires the new
-- comparisons.

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
    -- Humanization traits (0078) — formula-rolled at synthesis, must
    -- not be user-patched post-hoc.
    or new.disclosure_pace is distinct from old.disclosure_pace
    or new.silence_style is distinct from old.silence_style
    or new.punctuation_habit is distinct from old.punctuation_habit
    or new.memory_style is distinct from old.memory_style
    or new.text_burst_style is distinct from old.text_burst_style
    or new.voice_examples is distinct from old.voice_examples
  then
    raise exception 'oracles: this column is not user-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
