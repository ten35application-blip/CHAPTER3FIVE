-- 0078_humanization_traits
--
-- Adds Fable's ranked-most-important humanization dimensions to
-- oracles as PROBABILISTIC per-identity rolls. Every column is
-- nullable — Wilson's rule: "some identities should add, some
-- shouldn't." A null value means baseline behavior for that
-- dimension (no forced quirk), which keeps the population
-- naturally mixed instead of everyone being "quirky."
--
-- Baked into the FORMULA before synthesis so Claude generates a
-- persona_prompt that enacts whichever traits rolled (or doesn't
-- mention them at all when they didn't).
--
-- disclosure_pace (1-10 | null):
--   how fast they let a new person into deep stuff. 1 = slow, guarded,
--   makes you earn it; 10 = dumps on day one.
--
-- silence_style (text | null):
--   how they react when the USER goes quiet after saying something.
--   'sulk_soften' = cold next msg, warm the one after
--   'breezy'      = picks up like nothing happened
--   'double_text' = reaches out again in a few hours, worried
--   'fade'        = waits for you to come back
--
-- punctuation_habit (text | null):
--   one locked visual quirk. Rarer than the others (visual habits
--   stand out fast) so kept ~40% roll probability.
--   'ellipses_trailing', 'lowercase_no_periods', 'em_dash_heavy',
--   'no_exclamations', 'proper_sentences'
--
-- memory_style (text | null):
--   how faithfully they recall past turns. 'sharp' = perfect;
--   'warm_foggy' = remembers the feel, blurs details charmingly;
--   'conflator' = merges two similar past events.
--
-- text_burst_style (text | null):
--   default rhythm of their outgoing message count. Phase B multi-
--   message replies will actually enact this at stream time.
--   'one_liner', 'two_part', 'three_burst'
--
-- voice_examples (text[] | null):
--   4-6 in-voice sample texts written by Claude at synthesis time
--   and quoted verbatim under the persona_prompt "How I talk"
--   section. Also stored separately for observability + admin.

alter table public.oracles
  add column if not exists disclosure_pace int
    check (disclosure_pace is null or (disclosure_pace between 1 and 10)),
  add column if not exists silence_style text
    check (silence_style is null or silence_style in
      ('sulk_soften', 'breezy', 'double_text', 'fade')),
  add column if not exists punctuation_habit text
    check (punctuation_habit is null or punctuation_habit in
      ('ellipses_trailing', 'lowercase_no_periods', 'em_dash_heavy',
       'no_exclamations', 'proper_sentences')),
  add column if not exists memory_style text
    check (memory_style is null or memory_style in
      ('sharp', 'warm_foggy', 'conflator')),
  add column if not exists text_burst_style text
    check (text_burst_style is null or text_burst_style in
      ('one_liner', 'two_part', 'three_burst')),
  add column if not exists voice_examples text[];

-- User-write protection: these columns are part of the formula and
-- must not be user-mutable post-creation. Guarded by the existing
-- oracles column-protection trigger from 0067, which uses a name-list
-- allowlist. New columns default to protected because they aren't
-- on the allowlist — no trigger change needed.

comment on column public.oracles.disclosure_pace is
  'Fable humanization: 1-10 pace at which persona lets user in; null=baseline';
comment on column public.oracles.silence_style is
  'Fable humanization: how persona reacts to user silence; null=baseline';
comment on column public.oracles.punctuation_habit is
  'Fable humanization: locked visual quirk in outgoing text; null=baseline';
comment on column public.oracles.memory_style is
  'Fable humanization: fidelity of past-turn callbacks; null=baseline';
comment on column public.oracles.text_burst_style is
  'Fable humanization: default message-count rhythm (enacted in Phase B multi-msg)';
comment on column public.oracles.voice_examples is
  'Fable humanization: 4-6 in-voice sample texts, quoted verbatim in persona_prompt';
