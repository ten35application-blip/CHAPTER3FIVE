-- ============================================================================
-- 0112_creation_source_inherited.sql
--
-- oracles.creation_source is check-constrained to
-- ('random','photo','legacy'); the 0111 redemption copies stamp
-- 'inherited' so the audit trail distinguishes a redeemed copy from a
-- minted legacy identity. Extend the allowlist. Caught by the live
-- redemption simulation before any real redemption hit it.
--
-- Idempotent. Safe to run twice.
-- ============================================================================

alter table public.oracles
  drop constraint if exists oracles_creation_source_check;

alter table public.oracles
  add constraint oracles_creation_source_check
  check (creation_source = any (array[
    'random'::text,
    'photo'::text,
    'legacy'::text,
    'inherited'::text
  ]));
