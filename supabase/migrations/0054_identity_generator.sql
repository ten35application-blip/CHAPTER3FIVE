-- ============================================================================
-- 0054_identity_generator.sql
--
-- Adds the columns the /identity/new server action writes when creating a
-- generated identity: the trait bundle (jsonb), a canonical SHA-256
-- fingerprint (unique across the whole table — Wilson's uniqueness rule),
-- the persona's one-line hook, and the durable system prompt Claude writes
-- to make /chat/[id] respond AS that person.
--
-- Additive + idempotent. Existing rows (if any) get NULL for the new
-- columns; the app enforces non-null at insert time. Safe to run twice.
--
-- Relies on public.oracles from 0002_multi_oracle.sql. `name` already
-- exists on the table from earlier migrations.
-- ============================================================================

alter table public.oracles
  add column if not exists traits jsonb,
  add column if not exists fingerprint text,
  add column if not exists one_line_hook text,
  add column if not exists persona_prompt text;

-- Fingerprint uniqueness — Wilson's model depends on this. No two
-- identities can ever share a fingerprint. On collision the server
-- rerolls (~2^256 space; the constraint is defense in depth).
--
-- Uses a unique index (not table constraint) so IF NOT EXISTS works
-- cleanly on re-run.
create unique index if not exists oracles_fingerprint_key
  on public.oracles (fingerprint)
  where fingerprint is not null;

-- RLS is already enabled on public.oracles from 0002_multi_oracle.sql,
-- and the read/write policies already scope to auth.uid() = user_id.
-- No new policies needed — inserts through the server action inherit
-- the existing user-scoped write policy.
