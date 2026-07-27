-- Add a CHECK constraint on oracles.texting_fluency to match the
-- pattern the sibling humanization columns already use (chronotype in
-- 0080, memory_style / text_burst_style in 0078). The write path is
-- already guarded by protect_oracle_columns's trigger denylist, but
-- database-side value validation is a cheap belt against a
-- service-role INSERT (e.g. a future migration or admin tool)
-- landing an unknown value that then confuses the synth prompt.
--
-- Values must match src/lib/identity/formula.ts TEXTING_FLUENCIES.
-- Idempotent: drops-if-exists then re-adds so re-runs stay clean.

alter table public.oracles
  drop constraint if exists oracles_texting_fluency_check;

alter table public.oracles
  add constraint oracles_texting_fluency_check
  check (
    texting_fluency is null
    or texting_fluency in (
      'one_finger_slow',
      'voice_to_text',
      'fluent_thumbs',
      'formal_writer'
    )
  );
