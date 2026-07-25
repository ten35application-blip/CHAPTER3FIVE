-- 0075: persona-initiated outreach + web push subscription storage.
--
-- The outreach worker (/api/cron/persona-outreach) picks one eligible
-- identity per user per day and sends a warm, memory-anchored opener.
-- persona_outreach_events records each send for per-user (24h) and
-- per-persona (variable) throttling; the message itself lands in the
-- existing messages table with initiated_by='persona'.
--
-- All statements idempotent.

-- ============================================================================
-- 1. persona_outreach_events — throttle ledger
-- ============================================================================
create table if not exists public.persona_outreach_events (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  message_id uuid references public.messages(id) on delete set null
);

create index if not exists persona_outreach_events_user_sent_idx
  on public.persona_outreach_events (user_id, sent_at desc);
create index if not exists persona_outreach_events_oracle_sent_idx
  on public.persona_outreach_events (oracle_id, sent_at desc);

alter table public.persona_outreach_events enable row level security;

-- Read: users see their own ledger (opens the door to "who has
-- messaged me lately" analytics inside settings later). No client
-- write path — the worker uses the service role.
drop policy if exists "persona_outreach_events: users read their own"
  on public.persona_outreach_events;
create policy "persona_outreach_events: users read their own"
  on public.persona_outreach_events for select
  using (auth.uid() = user_id);

-- ============================================================================
-- 2. messages.initiated_by — analytics-friendly source tag
-- ============================================================================
-- The existing initiated_by_oracle boolean covers "the persona sent it
-- without a user turn immediately preceding," which is true for both
-- the daily 'proactive' cron and the new 'persona' outreach worker.
-- initiated_by lets us tell those apart when reading history later
-- (and leaves room for 'system', 'anniversary', 'check-in' rows).
alter table public.messages
  add column if not exists initiated_by text
    check (
      initiated_by is null
      or initiated_by in (
        'user',
        'persona',
        'proactive',
        'anniversary',
        'check_in',
        'daily_question',
        'system'
      )
    );

comment on column public.messages.initiated_by is
  'Analytics tag for who or what caused this message. Null = pre-migration or unclassified. Persona-outreach cron writes ''persona''.';

-- ============================================================================
-- 3. profiles.push_subscription — Web Push endpoint + keys
-- ============================================================================
-- Web Push subscriptions are opaque JSON blobs returned by
-- ServiceWorkerRegistration.pushManager.subscribe(). Storing the whole
-- thing keeps us agnostic to future browser fields. Nullable = user
-- hasn't opted in.
alter table public.profiles
  add column if not exists push_subscription jsonb;

comment on column public.profiles.push_subscription is
  'Web Push subscription (endpoint + keys.p256dh + keys.auth) returned by the browser. Null when the user has not opted in.';

-- profiles has table-wide SELECT/UPDATE grants (no column-level revoke
-- has been issued), so push_subscription inherits access without an
-- explicit grant. The existing owner UPDATE policy from 0001 restricts
-- writes to the caller's own row, and the billing-column protection
-- trigger doesn't touch push_subscription — so this column is safely
-- user-writable via the standard flow.
