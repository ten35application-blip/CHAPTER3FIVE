-- 0121_oracle_read_state
--
-- Cross-device "have I seen this thread" state. One row per
-- (user, oracle): last_read_at is the moment the user last had that
-- conversation open on ANY surface. Written by:
--
--   * web  — POST /api/chat/[id]/messages/read (ChatSurface fires it
--     on mount and after each streamed reply; deliberately NOT the
--     server render, so a route prefetch can't silently clear unread)
--   * mobile — app/conversation/[oracleId].tsx upserts at the same
--     moments (history load, foreground resync, realtime insert,
--     send-reply)
--
-- Read by both dashboards (and the iOS Home Screen widget pipeline)
-- to compute automatic unread: last message in the thread is from the
-- assistant AND newer than last_read_at. Replaces mobile's per-device
-- AsyncStorage markers so reading on web clears the phone's red dot
-- and vice versa.
--
-- Distinct from oracles.manually_unread (the user's explicit
-- "Mark as unread" flag) — the two are OR-ed at render, never merged.
--
-- Security posture: user-reachable table, so RLS + column allowlist.
-- Policies pin every verb to auth.uid() = user_id; blanket grants are
-- revoked and re-granted per column (all three columns are the
-- client's to write — PostgREST upsert's ON CONFLICT DO UPDATE sets
-- every payload column, so the update grant must cover the PK columns
-- too; WITH CHECK keeps user_id honest regardless).
--
-- No extra index: the (user_id, oracle_id) primary key covers the
-- only access path.
--
-- Idempotent. Safe to run twice.

create table if not exists public.oracle_read_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, oracle_id)
);

alter table public.oracle_read_state enable row level security;

drop policy if exists oracle_read_state_select_own on public.oracle_read_state;
create policy oracle_read_state_select_own
  on public.oracle_read_state for select
  using (auth.uid() = user_id);

drop policy if exists oracle_read_state_insert_own on public.oracle_read_state;
create policy oracle_read_state_insert_own
  on public.oracle_read_state for insert
  with check (auth.uid() = user_id);

drop policy if exists oracle_read_state_update_own on public.oracle_read_state;
create policy oracle_read_state_update_own
  on public.oracle_read_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists oracle_read_state_delete_own on public.oracle_read_state;
create policy oracle_read_state_delete_own
  on public.oracle_read_state for delete
  using (auth.uid() = user_id);

-- Column allowlist: wipe blanket grants, re-grant exactly what the
-- client writes. anon gets nothing.
revoke all on public.oracle_read_state from anon;
revoke all on public.oracle_read_state from authenticated;

grant select (user_id, oracle_id, last_read_at)
  on public.oracle_read_state to authenticated;
grant insert (user_id, oracle_id, last_read_at)
  on public.oracle_read_state to authenticated;
grant update (user_id, oracle_id, last_read_at)
  on public.oracle_read_state to authenticated;
grant delete on public.oracle_read_state to authenticated;

comment on table public.oracle_read_state is
  'Per-(user, oracle) last-read timestamp, written on every conversation open from web and mobile. Automatic unread = newest assistant message is newer than last_read_at. Distinct from oracles.manually_unread (explicit Mark-as-unread flag).';
