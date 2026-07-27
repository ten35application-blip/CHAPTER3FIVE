-- 0094_formula_expansion_v5
--
-- Formula expansion v5. Wilson greenlit Fable + Claude's joint
-- proposal to add 16 new personality dimensions. Most of them live
-- inside the Traits JSONB blob (oracles.traits column) — no schema
-- change needed for those. Only two need dedicated columns because
-- they're READ by other modules (chat stream, opener, outreach)
-- rather than only rendered into persona_prompt at synthesis time:
--
--   texting_fluency — modifies reply-gap latency + burst shape;
--                     read directly by src/lib/identity/replyGap.ts
--                     and burst logic in the chat stream.
--   pet_name         — referenced by openers + outreach so the
--                     persona can say "Biscuit's asleep on my foot"
--                     rather than "the dog's asleep." Named by
--                     Claude at synthesis time (SynthesizedPersona.
--                     pet_name).
--
-- Ongoing arc: stored ONLY as a template inside Traits JSONB. The
-- current stage is derived at chat time from (oracleId, weeks-since-
-- creation) via src/lib/identity/arc.ts — same shape as mood.
--
-- Column protection: both new columns join the existing
-- protect_oracle_columns denylist (0067 lineage → 0079 extension)
-- so a user with the anon key can't PATCH the pet's name or the
-- texting fluency after the fact. Service-role writes still pass.
--
-- Idempotent. Safe to run twice.

alter table public.oracles
  add column if not exists texting_fluency text,
  add column if not exists pet_name text;

comment on column public.oracles.texting_fluency is
  'Formula v5: how the persona relates to the medium of texting itself. Values: one_finger_slow, voice_to_text, fluent_thumbs, formal_writer. Null = no strong signal (baseline).';
comment on column public.oracles.pet_name is
  'Formula v5: name Claude gave the persona''s pet at synthesis time, so openers/outreach can reference it consistently. Null when the pet trait is No pets / Grand-dog / other non-owned shapes.';

-- Extend the existing oracles column-guard trigger (0079's shape:
-- protect_oracle_columns / oracles_protect_backend_columns). The
-- pattern is: enumerate every non-user-writable column in the
-- UPDATE denylist. INSERT stays fully blocked for PostgREST roles
-- per 0067's rule ("direct client inserts are not allowed") — new
-- columns land via the admin client at synthesis.
create or replace function public.protect_oracle_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := current_setting('role', true);
begin
  if caller_role in ('service_role', 'postgres', 'supabase_admin') then
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
  then
    raise exception 'oracles: this column is not user-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
