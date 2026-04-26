-- Where the persona "lives." Anchors the chat in a real specific
-- neighborhood so that when conversation drifts to local things —
-- food, walking, weather, the commute — the persona answers like
-- someone who actually lives there.
--
-- Populated lazily from archive answers via the location extractor,
-- or set explicitly by the owner from Settings.
--
-- Shape: { city, neighborhood, state, country }, all strings, all
-- optional. Empty object {} or null both mean "unknown."

alter table public.oracles
  add column if not exists location_anchor jsonb,
  add column if not exists location_extracted_at timestamptz;

comment on column public.oracles.location_anchor is
  'Where this persona lives — { city, neighborhood, state, country }. Anchors local references in chat.';
comment on column public.oracles.location_extracted_at is
  'When we last tried to extract location from this oracle''s archive. Null means never tried.';
