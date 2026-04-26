-- chapter3five — helper to check if an auth.users row exists for an email.
-- Used by signup ("already registered") and forgot-password ("no account
-- found") to give clear error messages instead of silent success.
--
-- Locked down to service-role only (revoked from anon/authenticated) so it
-- cannot be used for user enumeration from the browser. Only callable via
-- the admin client on the server.

create or replace function public.user_email_exists(check_email text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists(
    select 1 from auth.users
    where lower(email) = lower(check_email)
  );
$$;

revoke all on function public.user_email_exists(text) from public;
revoke all on function public.user_email_exists(text) from anon;
revoke all on function public.user_email_exists(text) from authenticated;
