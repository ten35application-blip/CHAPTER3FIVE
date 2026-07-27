-- 0089_terms_acceptances_dedupe
--
-- Fable audit on d48fdd0 flagged the ledger 60-second dedupe as a
-- read-then-insert without a unique constraint, so two truly
-- concurrent double-submits could both slip past the check and land
-- two rows. Not gameable (both would be a legitimate accept click)
-- but the ledger should be defensible.
--
-- Simple unique constraint on (user_id, terms_version) — one row per
-- user per version. If a user re-accepts the same version somehow,
-- the accept action catches 23505 and treats it as a no-op; the
-- earlier row is still the record of consent. Real re-consent
-- happens on version bumps, which change terms_version and land a
-- fresh row.
--
-- Original tried a date_trunc('minute', accepted_at) expression
-- index, which Postgres rejects because date_trunc on timestamptz
-- depends on the session timezone (not IMMUTABLE).
--
-- Idempotent. Safe to run twice.

create unique index if not exists terms_acceptances_user_version_unique_idx
  on public.terms_acceptances (user_id, terms_version)
  where user_id is not null;
