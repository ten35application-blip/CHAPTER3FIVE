-- ============================================================================
-- 0057_dashboard_features.sql
--
-- WILSON — RUN THIS YOURSELF. Either:
--   Supabase Studio → SQL Editor → New query → paste → Run
--   or from the repo root: npx supabase db push
--
-- Dashboard v3 additions:
--   1. oracles.is_starred      — pinned to the favorites row / top-right bubbles
--   2. oracles.manually_unread — user swiped right on the row to mark unread;
--                                the persona system prompt reads this on the
--                                next chat send so the identity can react to
--                                being ignored (feature ships fully when
--                                /chat/[id] is built).
--
-- Additive + idempotent. Safe to run twice.
-- ============================================================================

alter table public.oracles
  add column if not exists is_starred boolean not null default false,
  add column if not exists manually_unread boolean not null default false;

comment on column public.oracles.is_starred is
  'User has pinned this identity to the favorites row / top-right bubbles.';
comment on column public.oracles.manually_unread is
  'User swiped right on the conversation row to mark it unread. Read by the persona system prompt so the identity can acknowledge being ignored.';

-- Partial index — the dashboard query filters ORDER BY is_starred DESC, so a
-- targeted index on starred=true keeps the favorites row snappy at scale.
create index if not exists oracles_starred_idx
  on public.oracles (user_id, updated_at desc)
  where is_starred = true and deleted_at is null;
