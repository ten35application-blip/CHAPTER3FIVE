-- ============================================================================
-- 0058_avatars.sql
--
-- WILSON — RUN THIS YOURSELF. Either:
--   Supabase Studio → SQL Editor → New query → paste → Run
--   or from the repo root: npx supabase db push
--
-- Faces v1 (Replicate / FLUX 1.1 Pro):
--   1. Ensure the public-read `avatars` storage bucket exists. 0011 already
--      created it in existing environments — this insert is idempotent and
--      only matters for fresh databases. Generated faces are written by the
--      SERVICE-ROLE client from server code (service role bypasses storage
--      RLS entirely), so no new write policy is needed; 0011's per-user-
--      folder write policies stay intact for user-uploaded photos.
--   2. oracles.face_generation_status — lifecycle of the async face job:
--        null        → never attempted
--        'pending'   → generation in flight
--        'succeeded' → avatar_url points at our CDN copy
--        'failed'    → see face_generation_error
--   3. oracles.face_generation_error — message for the 'failed' case.
--   4. Index on face_generation_status for cron-like backfill/retry queries.
--   5. oracles.avatar_hash — SHA-256 hex of the generated image bytes, plus
--      a partial UNIQUE index. Wilson's rule: "no two of the same." The app
--      layer checks for hash collisions before persisting and regenerates
--      with a mutated seed; this index is the ultimate defense — if the app
--      check ever race-conditions, the second write of the same hash is
--      rejected by the DB and that oracle's face generation flips to
--      'failed' (retryable). In the astronomically-improbable case that 3
--      seed-mutated retries ALL collide, the app stores the hash suffixed
--      with '-collision' so this index doesn't block the write — see
--      src/lib/faces/generate.ts.
--
-- Additive + idempotent. Safe to run twice.
-- ============================================================================

-- Bucket: public read (public = true serves objects via the CDN public URL).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Face-generation lifecycle columns.
alter table public.oracles
  add column if not exists face_generation_status text
    check (face_generation_status in ('pending', 'succeeded', 'failed')),
  add column if not exists face_generation_error text,
  add column if not exists avatar_hash text;

comment on column public.oracles.avatar_hash is
  'SHA-256 hex of the generated avatar image bytes. Globally unique across '
  'all oracles (partial unique index below) so no two identities share a '
  'face. A ''-collision'' suffix marks the documented all-retries-collided '
  'edge case.';

-- Global face uniqueness — the DB-level backstop for the app-layer
-- collision check in generateAndSaveFace().
create unique index if not exists oracles_avatar_hash_unique
  on public.oracles (avatar_hash)
  where avatar_hash is not null;

-- Backfill/retry queries filter on status ("give me every failed / never-
-- attempted oracle"). Small table today, but this keeps that scan cheap
-- when a cron retry lands later.
create index if not exists oracles_face_generation_status_idx
  on public.oracles (face_generation_status);
