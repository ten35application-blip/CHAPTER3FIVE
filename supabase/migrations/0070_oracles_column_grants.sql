-- A table-wide SELECT grant supersedes a column-level revoke, so the grant
-- has to be re-issued per column. Every column except persona_prompt stays
-- readable by the client roles; persona_prompt is reachable only through the
-- service role.
revoke select on public.oracles from anon, authenticated;

grant select (
  id, user_id, name, mode, preferred_language, texting_style,
  onboarding_completed, created_at, updated_at, personality_type,
  emotional_flavor, timezone, avatar_url, deleted_at, scheduled_purge_at,
  bio, location_anchor, location_extracted_at, orientation,
  relationship_openness, identity_quirks, traits_extracted_at, ambient_cast,
  cast_extracted_at, weekly_context, weekly_context_until, sports_fandom,
  sports_extracted_at, memory_seed, memory_last_asked_at, traits,
  fingerprint, one_line_hook, is_legacy, legacy_answers, created_by,
  is_starred, manually_unread, face_generation_status, face_generation_error,
  avatar_hash, blocked_at, block_reason, significant_events, creation_source
) on public.oracles to anon, authenticated;
