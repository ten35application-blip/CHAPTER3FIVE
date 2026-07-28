-- 0114_concierge_cap_notices
--
-- Ledger for the concierge's cap-hit outreach. When a user trips a
-- monthly ceiling (message cap, image cap, or the free-tier spend
-- governor) the API inserts a message FROM the concierge offering a
-- top-off, plus a web push. This table is the server-side dedupe +
-- audit trail:
--
--   * one notice per (user, cap_kind, calendar month) — enforced by a
--     unique index, raced-insert-safe (the second insert 23505s and
--     the caller treats that as "already sent")
--   * the chat stream's top-off intercept only mints a checkout link
--     when a recent row exists here — users cannot forge one, so the
--     intercept can't be driven without a real server-recorded cap hit
--   * checkout_count bounds how many checkout sessions the intercept
--     will mint off one notice (server-side rate limit)
--
-- Security posture: RLS enabled with NO policies and all table grants
-- revoked from anon + authenticated. Every read/write goes through the
-- service-role client. Nothing here is client-visible state — the
-- user-facing artifact is the concierge message itself.

create table if not exists public.concierge_cap_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cap_kind text not null check (cap_kind in ('messages', 'images', 'spend')),
  -- 'YYYY-MM' (UTC) — the calendar month the notice covers.
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  notified_at timestamptz not null default now(),
  -- The concierge message row this notice produced (null if the
  -- message insert failed after the notice row landed).
  message_id uuid references public.messages(id) on delete set null,
  -- How many checkout sessions the chat intercept has minted against
  -- this notice. Server-incremented; the intercept refuses past its cap.
  checkout_count integer not null default 0,
  last_checkout_at timestamptz
);

create unique index if not exists concierge_cap_notices_user_kind_month
  on public.concierge_cap_notices (user_id, cap_kind, month);

create index if not exists concierge_cap_notices_user_notified_idx
  on public.concierge_cap_notices (user_id, notified_at desc);

alter table public.concierge_cap_notices enable row level security;

-- Admin-write, admin-read only: no policies, no grants. service_role
-- bypasses RLS; anon/authenticated get nothing at the grant layer
-- either (belt + suspenders — a future permissive policy alone would
-- still hit the missing grant).
revoke all on public.concierge_cap_notices from anon;
revoke all on public.concierge_cap_notices from authenticated;

comment on table public.concierge_cap_notices is
  'Dedupe + audit ledger for concierge (Adrian) cap-hit outreach. One row per user/cap_kind/calendar-month. Service-role only; the chat top-off intercept requires a recent row here before minting a Stripe checkout link.';

-- Allow 'concierge' as a messages.initiated_by value so the cap-notice
-- message is distinguishable from cron-driven persona outreach in
-- analytics. The constraint was created inline in 0075, so it carries
-- the default generated name.
alter table public.messages
  drop constraint if exists messages_initiated_by_check;
alter table public.messages
  add constraint messages_initiated_by_check check (
    initiated_by is null
    or initiated_by in (
      'user',
      'persona',
      'proactive',
      'anniversary',
      'check_in',
      'daily_question',
      'system',
      'concierge'
    )
  );
