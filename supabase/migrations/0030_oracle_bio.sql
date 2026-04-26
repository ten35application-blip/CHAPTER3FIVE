-- chapter3five — oracle bio.
--
-- For randomized identities specifically: a synthesized backstory
-- (age, place, occupation, defining traits) generated from the
-- random 355 answers + the chosen personality + emotional flavor.
-- Anchors the persona so they feel like a specific person from the
-- moment they're created, instead of an anonymous-but-personality'd
-- voice.
--
-- For real-mode identities, the bio is empty/null — the person being
-- preserved IS the bio, no synthesis needed. Could be auto-populated
-- from real answers later if useful, but for v1 it's randomize-only.
--
-- Stored as text (the persona's first-person introduction). Injected
-- into the chat system prompt so the persona has concrete anchors
-- instead of relying on emergent properties of the random answers.

alter table public.oracles
  add column if not exists bio text;
