-- 0133_grant_failures
--
-- A durable record of "the customer paid and we did not deliver."
--
-- Six places in the Stripe webhook can charge a card and then fail to
-- grant the thing that was bought. Every one of them handled it the
-- same way: console.error, then carry on and return 200. The comment on
-- the first one is honest about what that means —
--
--   "Loud: the user PAID and the grant failed. Stripe will retry the
--    event, but the payments row is already claimed paid, so the retry
--    short-circuits -- this log is the signal for a manual re-grant."
--
-- The problem is that a log line is not a signal. It is a string in
-- Vercel's log viewer, retained for a limited window, that nobody is
-- watching at 2am. And because the retry short-circuits by design, the
-- automatic recovery everyone assumes Stripe provides does not happen
-- here. So the actual behaviour is: money in, nothing out, no trace
-- anyone will ever look at.
--
-- One of those six is the inherited-slot grant. That is the code path
-- where someone pays $5 to open the archive of a person who died. If it
-- fails they are charged, told nothing useful, and the archive stays
-- shut.
--
-- This table is the trace. Every failure writes a row carrying enough
-- to re-grant by hand without going back to Stripe: who, what, how much,
-- which event, and the database error. /api/admin/grant-failures reads
-- it, and rows stay until explicitly resolved.
--
-- Deliberately NOT a queue with automatic retries. Re-granting money is
-- exactly the kind of thing that should require a person to look at it —
-- an auto-retry loop on a grant that failed for an unknown reason is how
-- you turn one silent under-delivery into a silent double-delivery.
--
-- user_id is `on delete set null` rather than cascade: if the account is
-- later purged, the fact that we owed them something must outlive it.
-- The stripe ids are kept precisely so the row is still actionable then.
--
-- Idempotent. Safe to run twice.

create table if not exists public.grant_failures (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  user_id           uuid references auth.users(id) on delete set null,
  stripe_event_id   text,
  stripe_session_id text,
  -- What should have been granted. 'unrecognized_purchase' means the
  -- money arrived with metadata we could not map to anything at all,
  -- which is the worst case: we know they paid and not what for.
  kind              text not null,
  delta             integer,
  purpose           text,
  error             text,
  resolved_at       timestamptz,
  resolved_by       text,
  notes             text
);

create index if not exists grant_failures_unresolved_idx
  on public.grant_failures (created_at desc)
  where resolved_at is null;

create index if not exists grant_failures_user_idx
  on public.grant_failures (user_id);

-- Service-role only. RLS on with no policies at all is the correct
-- shape here: PostgREST roles get nothing, the admin client bypasses
-- RLS, and the admin readout goes through the admin client.
alter table public.grant_failures enable row level security;

revoke all on public.grant_failures from anon, authenticated;

comment on table public.grant_failures is
  'Customer paid, grant failed. Written by the Stripe webhook; read by /api/admin/grant-failures. Rows persist until a human resolves them.';
