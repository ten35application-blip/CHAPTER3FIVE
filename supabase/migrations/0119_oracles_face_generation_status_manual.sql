-- 0119_oracles_face_generation_status_manual
--
-- Extend the oracles_face_generation_status_check CHECK constraint
-- to allow 'manual' alongside the existing pending/succeeded/failed.
--
-- Wilson's ask 2026-07-29: hand-picked a portrait for Adrian on his
-- Desktop instead of using the Flux-generated version. The ops
-- script scripts/set-adrian-avatar.mjs writes
-- face_generation_status='manual' as a guard so the admin regen
-- route (/api/admin/adrian/generate-avatar, which forces
-- ensureAdrianAvatar) can no longer silently overwrite the
-- hand-picked image on a stray click. src/lib/faces/adrian.ts's
-- ensureAdrianAvatar refuses to regenerate when status='manual'
-- unless the caller passes overrideManual: true.
--
-- Only the concierge row will carry 'manual' today. Any future
-- from-photo / from-upload flow that wants the same protection can
-- reuse the value.
--
-- Backfill: NOT applied here. Existing rows keep their current
-- statuses (succeeded/failed/pending/null). The ops script updates
-- the concierge row to 'manual' on next run.
--
-- Idempotent. Safe to run twice.

alter table public.oracles
  drop constraint if exists oracles_face_generation_status_check;

alter table public.oracles
  add constraint oracles_face_generation_status_check
    check (
      face_generation_status is null
      or face_generation_status = any (
        array['pending'::text, 'succeeded'::text, 'failed'::text, 'manual'::text]
      )
    );

comment on constraint oracles_face_generation_status_check on public.oracles is
  'Allowed face_generation_status values. manual = hand-picked portrait uploaded via scripts/set-adrian-avatar.mjs; ensureAdrianAvatar refuses regeneration on manual rows unless overrideManual is passed.';
