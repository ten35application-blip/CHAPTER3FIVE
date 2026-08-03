-- ============================================================
-- oracle_reports
-- ============================================================
-- Per-identity reports from a user, mirroring public.message_reports
-- (0077) row for row. A per-message report ("this reply was off /
-- inappropriate / spam / etc.") wasn't enough to cover App Store 1.2
-- and Play UGC expectations: reviewers want a "Report this identity"
-- affordance for cases where the persona's whole shape is the issue
-- (drifted persona_prompt, off-brand face-generation, etc.). New
-- sibling table keeps existing message_reports untouched — same shape,
-- same RLS pattern, same admin resolve pipeline, so nothing about the
-- existing per-message flow changes.
--
-- Wilson flagged approval 2026-08-03 (sibling table over adding
-- target_kind + nullable message_id on message_reports).

create table public.oracle_reports (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in ('inappropriate', 'harmful', 'off_character', 'spam', 'other')
  ),
  notes text,
  status text not null default 'pending' check (
    status in ('pending', 'reviewed', 'dismissed')
  ),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index oracle_reports_status_idx
  on public.oracle_reports (status, created_at desc);

create index oracle_reports_oracle_idx
  on public.oracle_reports (oracle_id);

-- Partial-unique dedupe: one pending report per (oracle, reporter)
-- so a double-tap doesn't flood the queue. A resolved report on the
-- same identity can be re-opened by the user only after the previous
-- one is resolved — mirrors 0082's message_reports_pending_dedupe_idx.
create unique index oracle_reports_pending_dedupe_idx
  on public.oracle_reports (oracle_id, reporter_user_id)
  where status = 'pending';

alter table public.oracle_reports enable row level security;

-- User can insert a report for any oracle they have a chat with —
-- meaning either they own the oracle (own-created identity) OR they
-- have exchanged messages with it (concierge Adrian, an identity they
-- inherited but don't own outright, etc.). Mirrors the message_reports
-- "owns the thread" test but scoped to the oracle rather than a
-- specific message row.
create policy "oracle reports: user reports oracles they interact with"
  on public.oracle_reports
  for insert
  with check (
    reporter_user_id = auth.uid()
    and (
      exists (
        select 1 from public.oracles o
        where o.id = oracle_reports.oracle_id
          and o.user_id = auth.uid()
      )
      or exists (
        select 1 from public.messages m
        where m.oracle_id = oracle_reports.oracle_id
          and m.user_id = auth.uid()
        limit 1
      )
    )
  );

-- User can see their own submitted reports.
create policy "oracle reports: user reads own reports"
  on public.oracle_reports
  for select
  using (reporter_user_id = auth.uid());

-- No user UPDATE / DELETE — resolution is admin-only via service role.

grant select, insert on public.oracle_reports to authenticated;
