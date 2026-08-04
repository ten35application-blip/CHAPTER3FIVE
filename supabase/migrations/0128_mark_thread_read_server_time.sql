-- 0128_mark_thread_read_server_time
--
-- NOTE: applied to the remote project as "0127_mark_thread_read_server_time"
-- before 0127_grant_is_self_archive_select.sql was noticed locally.
-- Renumbered here so the repo sequence stays monotonic. The body is
-- idempotent (create or replace + revoke/grant), so re-running is safe
-- and reconciles either ordering.
--
-- Server-clock read stamping.
--
-- Problem: mobile app/conversation/[oracleId].tsx upserted
-- oracle_read_state.last_read_at with `new Date().toISOString()` — the
-- HANDSET clock. Automatic unread is computed by comparing that value
-- against messages.created_at, which is always server-side now(). On a
-- phone whose clock runs even slightly behind, last_read_at lands
-- BEFORE the message it was meant to acknowledge, so the row stays
-- unread forever: the user opens the thread, leaves, and the highlight
-- (and the Home Screen widget dot) never clears. No amount of
-- re-opening fixes it, because every stamp is skewed the same way.
--
-- Web was never affected — its read route computes the timestamp in the
-- Node runtime, which is the same clock as now(). Both surfaces call
-- this function now, so the two can no longer drift apart.
--
-- Fix: one RPC both surfaces call, where the timestamp is taken from
-- the database rather than the caller. Clients no longer send a time at
-- all, so there is nothing to skew.
--
-- Security posture: SECURITY INVOKER (the default) so the existing 0121
-- RLS policies still apply exactly as they do to a direct upsert — this
-- function grants no authority the caller didn't already have. user_id
-- comes from auth.uid(), never from a parameter, so a caller cannot
-- stamp another user's row. A caller with no session (auth.uid() null)
-- fails the RLS check and writes nothing.
--
-- Idempotent. Safe to run twice.

create or replace function public.mark_thread_read(p_oracle_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.oracle_read_state (user_id, oracle_id, last_read_at)
  values (auth.uid(), p_oracle_id, now())
  on conflict (user_id, oracle_id)
  do update set last_read_at = now();
$$;

comment on function public.mark_thread_read(uuid) is
  'Stamps oracle_read_state.last_read_at from the SERVER clock for the calling user. Exists because device clock skew on mobile could make last_read_at predate the message it acknowledged, pinning a thread unread forever. SECURITY INVOKER: 0121 RLS still governs the write.';

revoke all on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;
