-- These helpers are referenced inside RLS policy expressions, which are
-- evaluated as the querying role. The role therefore needs EXECUTE or every
-- policy that calls them fails closed. Grant explicitly to the client roles
-- (narrower than the default PUBLIC grant) and keep PUBLIC revoked.
grant execute on function public.user_owns_oracle(uuid) to anon, authenticated;
grant execute on function public.user_has_share_on_oracle(uuid) to anon, authenticated;
grant execute on function public.user_has_grant_on_oracle(uuid) to anon, authenticated;
grant execute on function public.user_in_beneficiary_room(uuid) to anon, authenticated;

-- Trigger functions are never called directly and are not referenced by any
-- policy, so they can be closed off entirely.
revoke execute on function public.protect_oracle_columns() from public, anon, authenticated;
revoke execute on function public.protect_inherit_code_columns() from public, anon, authenticated;
revoke execute on function public.protect_billing_columns() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Upload buckets carry an image allowlist and a size ceiling.
update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/heic'],
    file_size_limit = 8388608
where id in ('avatars','archive-photos','chat-photos');
