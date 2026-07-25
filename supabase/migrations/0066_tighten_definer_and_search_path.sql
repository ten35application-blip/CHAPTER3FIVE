-- ============================================================================
-- 0066_tighten_definer_and_search_path.sql
--
-- Applied to live DB via MCP. Committing so a fresh environment gets
-- the same shape via `supabase db push`.
--
-- Batch of lint-driven hardening. Each block below tightens a rule
-- surfaced by Supabase's `get_advisors` security lint. None of the
-- changes require coordination with each other; they're batched for
-- convenience.
--
-- Idempotent. Safe to run twice.
-- ============================================================================

-- 1. SECURITY DEFINER helpers are called only from RLS policies and
--    triggers. They should not be reachable as REST RPC endpoints.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.user_owns_oracle(uuid) from anon, authenticated;
revoke execute on function public.user_has_share_on_oracle(uuid) from anon, authenticated;
revoke execute on function public.user_has_grant_on_oracle(uuid) from anon, authenticated;

-- 2. Pin search_path on functions to their intended schema so a
--    caller cannot cause them to resolve to shadow objects in a
--    schema they control.
alter function public.touch_updated_at() set search_path = public;
alter function public.protect_billing_columns() set search_path = public;

-- 3. Waitlist table has an unrestricted anon INSERT policy from 0001
--    and is not referenced by any application code. Remove the open
--    write vector; the table stays so a future waitlist feature can
--    add a deliberate policy back.
drop policy if exists "waitlist: anyone can sign up" on public.waitlist;

-- 4. The `avatars` bucket is public — object URLs are served without
--    a policy. The extra broad SELECT on storage.objects additionally
--    let clients LIST every avatar path. Remove it; URL reads keep
--    working via the public bucket setting.
drop policy if exists "avatars: anyone read" on storage.objects;
