-- Persona traits: who they're attracted to, how open they are to that
-- being a thing in conversation, and the specific quirks/identities
-- that color how they show up.
--
-- For real-mode oracles: extracted from archive answers, owner-editable.
-- For randomized oracles: rolled at synthesis time from a wide,
-- intentionally-weird pool so no two personas feel the same.
--
-- These feed the chat system prompt as a "WHO YOU ARE (extras)" block.
-- They are NOT shown on a profile or stat sheet — the user discovers
-- them by talking, the way you'd find out about a real person.

alter table public.oracles
  add column if not exists orientation text,
  add column if not exists relationship_openness text,
  add column if not exists identity_quirks text[],
  add column if not exists traits_extracted_at timestamptz;

-- Open vocabulary: validated in app code, not in the schema, so we can
-- expand the pool without migrations.
comment on column public.oracles.orientation is
  'Sexual orientation: straight | gay | lesbian | bi | pan | ace | unspecified';
comment on column public.oracles.relationship_openness is
  'Romantic openness: flirty | warm | reserved | partnered | uninterested';
comment on column public.oracles.identity_quirks is
  'Specific identity flavors that come up unprompted in conversation.';
comment on column public.oracles.traits_extracted_at is
  'When we last tried to extract traits from this oracle''s archive. Null = never tried.';
