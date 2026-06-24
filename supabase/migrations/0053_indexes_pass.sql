-- chapter3five — 1.2 release index pass. Closes the hot-path index
-- gaps surfaced by the v1.2 performance audit.
--
-- Each index is gated on "if not exists" so re-running is safe.
-- All are concurrent-safe; create them off-peak if the tables are
-- already large.

-- Outreach + check-in crons filter "active in the last N days".
-- Without this, every cron run full-scans profiles.
create index if not exists profiles_last_active_at_idx
  on public.profiles (last_active_at desc);

-- Dashboard last-message lookup. We filter messages by user_id
-- AND oracle_id IN (…), then order by created_at desc. Composite
-- index lets us avoid scanning many oracle's worth of messages.
create index if not exists messages_user_oracle_created_idx
  on public.messages (user_id, oracle_id, created_at desc);

-- Beneficiary cap checks + dashboard reads filter by owner +
-- status (excludes 'removed'). Composite serves both.
create index if not exists beneficiaries_owner_status_idx
  on public.beneficiaries (owner_user_id, status);

-- Persona memory retrieval scopes by oracle + user. Used on every
-- chat turn for memory pull.
create index if not exists persona_memories_oracle_user_idx
  on public.persona_memories (oracle_id, user_id);

-- Dashboard oracle list filters by user_id + deleted_at IS NULL.
-- The owner-of-oracle paths hit this constantly.
create index if not exists oracles_user_active_idx
  on public.oracles (user_id)
  where deleted_at is null;
