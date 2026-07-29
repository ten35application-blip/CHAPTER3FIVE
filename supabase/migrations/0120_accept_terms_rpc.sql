-- 0120_accept_terms_rpc
--
-- SECURITY DEFINER RPC that atomically stamps terms acceptance +
-- fills in default active_oracle_id / oracle_name from the concierge
-- in a single UPDATE. Replaces the read-then-upsert pattern in
-- /api/user/accept-terms which had a narrow race window: an
-- inherited-code redemption landing between the read and the upsert
-- would get its just-written active_oracle_id clobbered by whatever
-- the accept-terms call had read a millisecond earlier.
--
-- Fable audit M-1 fix.
--
-- The COALESCE on active_oracle_id / oracle_name preserves any
-- pre-existing value (an inherited-code identity, an in-flight
-- restore) and only fills the concierge default when the column is
-- currently null. Terms columns are always overwritten -- that's
-- the whole point of the endpoint.
--
-- SECURITY DEFINER so an authenticated caller doesn't need direct
-- write access to the server-only columns (0087/0090 triggers block
-- authenticated writes to terms_accepted_at / terms_version_accepted;
-- SECURITY DEFINER runs as owner which bypasses).
--
-- Idempotent. Safe to run twice.

create or replace function public.accept_terms_and_default_oracle(
  p_user_id uuid,
  p_terms_version text,
  p_concierge_id uuid,
  p_concierge_name text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set terms_accepted_at = now(),
         terms_version_accepted = p_terms_version,
         active_oracle_id = coalesce(active_oracle_id, p_concierge_id),
         oracle_name = coalesce(oracle_name, p_concierge_name),
         onboarding_completed = true
   where id = p_user_id;
end;
$$;

comment on function public.accept_terms_and_default_oracle is
  'Atomic terms-acceptance + default-oracle write for /api/user/accept-terms. COALESCE preserves inherited-code identities that landed between the client tap and the server write.';

-- Deliberately NOT granted to anon / authenticated -- only the
-- admin-client route call reaches this. If the calling role isn't
-- service_role, the SECURITY DEFINER function still runs as owner
-- so the terms columns can be written, but we still want the
-- function scoped to server-only callers.
revoke all on function public.accept_terms_and_default_oracle from public;
grant execute on function public.accept_terms_and_default_oracle to service_role;
