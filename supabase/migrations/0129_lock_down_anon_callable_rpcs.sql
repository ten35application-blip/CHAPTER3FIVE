-- 0129_lock_down_anon_callable_rpcs
--
-- Applied to the remote project 2026-08-04.
--
-- Three SECURITY DEFINER functions were callable by `anon` and
-- `authenticated`, and two take a victim's user id as a PARAMETER and
-- never compare it to auth.uid().
--
-- ROOT CAUSE, worth writing down because it will recur: 0120 and 0126
-- both intended to lock these down and both wrote only
--
--     revoke all on function ... from public;
--     grant execute on function ... to service_role;
--
-- `REVOKE ... FROM public` removes the PUBLIC pseudo-role grant. It
-- does NOT remove the grants Supabase hands directly to the `anon` and
-- `authenticated` roles via ALTER DEFAULT PRIVILEGES on every new
-- function in `public`. The revoke was a no-op; the functions stayed
-- open. Six earlier migrations (0016, 0017, 0018, 0106, 0107, 0113)
-- use the correct three-way form — the pattern was known and dropped.
--
-- Note also that `create or replace function` RESETS grants to the
-- default set. Any migration that replaces a function body must
-- re-issue its revokes afterwards, which is why they appear twice
-- below.
--
-- IMPACT BEFORE THIS: an unauthenticated caller holding only the
-- public anon key could flip auto-populate state on ANY user id —
-- permanently marking a paying subscriber's auto-populate "complete"
-- so the identities they paid for never generate.
-- try_acquire_auto_populate_lock also returns a boolean revealing
-- whether a given uuid has a profile row: a user-id enumeration
-- oracle.
--
-- Two layers: explicit revokes, plus an auth.uid() guard inside each
-- function so a future accidental grant still cannot cross accounts.
-- service_role passes the guard (auth.uid() is null there) — all three
-- functions are called only from server routes with the service key
-- (verified: accept-terms/route.ts:131, autoPopulate.ts:146,185).
--
-- Bodies below are the live definitions read back from
-- pg_get_functiondef with only the guard prepended. No logic changed.
-- The real parameter is stale_after_SECONDS (default 300), and
-- try_acquire also resets auto_populate_completed_at — both preserved.
--
-- Idempotent.

revoke all on function public.try_acquire_auto_populate_lock(uuid, integer) from public, anon, authenticated;
revoke all on function public.mark_auto_populate_complete(uuid) from public, anon, authenticated;
revoke all on function public.accept_terms_and_default_oracle(uuid, text, uuid, text) from public, anon, authenticated;

grant execute on function public.try_acquire_auto_populate_lock(uuid, integer) to service_role;
grant execute on function public.mark_auto_populate_complete(uuid) to service_role;
grant execute on function public.accept_terms_and_default_oracle(uuid, text, uuid, text) to service_role;

create or replace function public.mark_auto_populate_complete(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'not your account' using errcode = '42501';
  end if;

  update public.profiles
    set auto_populate_completed_at = now()
    where id = target_user_id;
end;
$function$;

create or replace function public.try_acquire_auto_populate_lock(
  target_user_id uuid,
  stale_after_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  now_ts timestamptz := now();
  updated_rows integer;
begin
  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'not your account' using errcode = '42501';
  end if;

  update public.profiles
    set auto_populate_started_at = now_ts,
        auto_populate_completed_at = null
    where id = target_user_id
      and (
        auto_populate_started_at is null
        or auto_populate_completed_at is not null
        or auto_populate_started_at < now_ts - make_interval(secs => stale_after_seconds)
      );
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$function$;

-- create or replace reset the grants above; re-issue them.
revoke all on function public.try_acquire_auto_populate_lock(uuid, integer) from public, anon, authenticated;
revoke all on function public.mark_auto_populate_complete(uuid) from public, anon, authenticated;
grant execute on function public.try_acquire_auto_populate_lock(uuid, integer) to service_role;
grant execute on function public.mark_auto_populate_complete(uuid) to service_role;
