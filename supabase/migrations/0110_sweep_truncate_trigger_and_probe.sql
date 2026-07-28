-- 0110_sweep_truncate_trigger_and_probe
--
-- Follow-up sweep from Fable's re-audit of 0109. All four original
-- findings are closed. These are the two residual items + one
-- defense-in-depth add:
--
-- 1) TRUNCATE + TRIGGER are granted to anon + authenticated on every
--    public.* table by Supabase's default column-privilege template.
--    PostgREST cannot emit TRUNCATE (needs direct DB), so this isn't
--    reachable through the app's normal surface — but if any future
--    tooling (SQL runner, exposed function, direct-URL leak) ever
--    lets a client role reach the DB, TRUNCATE bypasses RLS, the
--    column allowlist, and the trigger. Revoke schema-wide. TRIGGER
--    is the privilege to CREATE TRIGGER on a table — never legitimate
--    for client roles.
--
-- 2) `public._probe_role()` — SECURITY DEFINER diagnostic left over
--    from Fable's own probe run. Present in the DB, absent from every
--    migration file. Callable by anon via REST; leaks the role
--    context Fable used to build the audit but no user data. Drop it
--    so the DB matches the migration history.
--
-- 3) `bump_message_retry_count(uuid, int)` — take a caller_user_id
--    parameter and verify the target message belongs to that user.
--    Today's only caller is the stream route with a user-derived ID
--    from an RLS-scoped SELECT, so this is defense-in-depth for the
--    day someone accidentally calls it with client-supplied input.

-- 1) revoke TRUNCATE + TRIGGER schema-wide on public.
--    ALL TABLES IN SCHEMA is the sweep form; new tables are covered
--    prospectively by revoking the same in ALTER DEFAULT PRIVILEGES.
revoke truncate, trigger on all tables in schema public from anon;
revoke truncate, trigger on all tables in schema public from authenticated;

-- New tables inherit privileges from ALTER DEFAULT PRIVILEGES rows.
-- We can only alter defaults for roles we're currently authenticated
-- as (postgres, in the migration path). Supabase's own template
-- (owned by supabase_admin) will re-grant on future migrations; a
-- follow-up sweep can be run via the SQL editor if that becomes a
-- pattern.
alter default privileges for role postgres in schema public
  revoke truncate, trigger on tables from anon, authenticated;

-- 2) drop the leftover diagnostic function
drop function if exists public._probe_role();

-- 3) ownership-guarded retry bump. Rewrites the RPC to take the
--    caller's user_id and refuses if the message doesn't belong to
--    them. Still SECURITY DEFINER + service_role-only.
create or replace function public.bump_message_retry_count(
  caller_user_id uuid,
  target_message_id uuid,
  max_allowed integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.messages
    set retry_count = retry_count + 1
    where id = target_message_id
      and user_id = caller_user_id
      and retry_count < max_allowed
    returning retry_count into new_count;
  return new_count;  -- null if no row was updated (cap hit, wrong owner, or missing)
end;
$$;

-- Drop the old signature so no accidental caller can hit it.
drop function if exists public.bump_message_retry_count(uuid, integer);

revoke execute on function public.bump_message_retry_count(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.bump_message_retry_count(uuid, uuid, integer)
  to service_role;

-- Advisor-noise cleanup: trigger fns error if called directly, but
-- revoking execute is cheap and satisfies the linter.
revoke execute on function public.enforce_messages_column_writes()
  from public, anon, authenticated;
