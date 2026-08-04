-- 0132_oracles_update_allowlist
--
-- `oracles` is protected by a DENYLIST and nothing else. `authenticated`
-- holds UPDATE on all 62 columns; two triggers (protect_oracle_columns
-- from 0068/0079/0096, protect_oracle_state from 0091/0117) then raise
-- 42501 on a named subset. Thirty columns are named. Thirty-two are not.
--
-- A denylist gets the default backwards. Every column added from here on
-- is user-writable the moment it exists, and stays that way until
-- somebody remembers to extend a trigger. That has already happened
-- three times in this repo's history — 0079, 0096 and 0117 each exist
-- solely to catch a column up to a guard it should have had at birth.
-- 0079 says so in its own header: "new columns default to user-mutable,
-- which is not what we want."
--
-- WHAT IS ACTUALLY REACHABLE TODAY. The interesting ones are the
-- extracted-context columns — memory_seed, weekly_context, ambient_cast,
-- location_anchor, sports_fandom, identity_quirks, bio, one_line_hook.
-- persona_prompt and traits are locked, so the persona's own text can't
-- be rewritten. But these columns are read at chat time and interpolated
-- into the same system prompt, which makes them a second door into it —
-- one a user can PATCH directly with the anon key. Someone can hand
-- their own companion a new set of instructions and walk it past the
-- crisis rules, the archive posture, and the disclosure gates.
--
-- Self-directed, and output moderation still runs. But "the app can be
-- talked out of its safety instructions by its own user, over HTTP,
-- without a jailbreak" is not a sentence to carry into App Store review
-- under Guideline 1.2, and it is not what the Settings page describes.
--
-- The extraction crons that legitimately write these columns all use
-- createAdminClient() — verified call site by call site — so revoking
-- the user-role grant costs them nothing.
--
-- THE FIX: invert it. Revoke UPDATE on the table, grant it back on the
-- five columns a user client actually writes. New columns then arrive
-- with no UPDATE privilege at all, and the next person to add one has to
-- opt in deliberately instead of remembering to opt out.
--
-- THE FIVE, and where each is written with a user-role client:
--   conversation_archived_at  web dashboard/actions.ts, mobile dashboard.tsx
--   manually_unread           web dashboard/actions.ts, mobile dashboard.tsx
--   is_starred                mobile dashboard.tsx (web routes it via admin,
--                             but the phone does not — omitting this breaks
--                             the star on iOS and Android)
--   deleted_at                web dashboard/actions.ts + settings/delete/actions.ts
--                             (soft delete only; protect_oracle_state still
--                             enforces the one-way direction, so restore
--                             stays on the paid webhook path)
--   memory_seed               api/identities/[id]/memory-add — the user
--                             adding a memory by hand, a real feature
--
-- Enumerated from every .from("oracles").update() in both repos, with the
-- client variable resolved at each site. No SECURITY INVOKER function
-- updates this table, so nothing reaches it by another route.
--
-- anon loses UPDATE entirely: every one of these paths requires a signed-in
-- user, so anon never had a legitimate reason to hold it.
--
-- Both triggers stay. Grants stop the write; the triggers keep the
-- directional guard on deleted_at and remain a second line if a grant is
-- ever widened by accident.
--
-- Idempotent. Safe to run twice.

revoke update on public.oracles from anon, authenticated;

grant update (
  conversation_archived_at,
  manually_unread,
  is_starred,
  deleted_at,
  memory_seed
) on public.oracles to authenticated;
