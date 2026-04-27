-- Fix: infinite recursion between oracles RLS and archive_grants RLS.
--
-- The original setup had:
--   oracles.policy "invitees read via grant" — subqueries archive_grants
--   archive_grants.policy "owner reads grants" — subqueries oracles
-- Each table's policy triggers the other table's RLS, which triggers
-- the original table's RLS again → recursion. Postgres detects and
-- aborts with "infinite recursion detected in policy for relation".
--
-- Standard Supabase fix: replace cross-table EXISTS in policies with
-- SECURITY DEFINER helper functions that bypass RLS. The functions
-- can query freely without re-triggering policy evaluation.

-- Helper: does the current user own this oracle?
create or replace function public.user_owns_oracle(p_oracle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.oracles
    where id = p_oracle_id and user_id = auth.uid()
  );
$$;

-- Helper: does the current user have an archive_grant on this oracle?
create or replace function public.user_has_grant_on_oracle(p_oracle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.archive_grants
    where oracle_id = p_oracle_id and user_id = auth.uid()
  );
$$;

-- Replace the recursive oracles policy.
drop policy if exists "oracles: invitees read via grant" on public.oracles;
create policy "oracles: invitees read via grant"
  on public.oracles for select
  using (public.user_has_grant_on_oracle(id));

-- Replace the recursive archive_grants policies.
drop policy if exists "archive_grants: owner reads grants on their oracles" on public.archive_grants;
create policy "archive_grants: owner reads grants on their oracles"
  on public.archive_grants for select
  using (public.user_owns_oracle(oracle_id));

drop policy if exists "archive_grants: owner inserts" on public.archive_grants;
create policy "archive_grants: owner inserts"
  on public.archive_grants for insert
  with check (public.user_owns_oracle(oracle_id));

drop policy if exists "archive_grants: owner revokes" on public.archive_grants;
create policy "archive_grants: owner revokes"
  on public.archive_grants for delete
  using (public.user_owns_oracle(oracle_id));

-- The "answers: invitees read via grant" policy (also in 0014) has
-- the same shape — replace it too if it's there.
drop policy if exists "answers: invitees read via grant" on public.answers;
create policy "answers: invitees read via grant"
  on public.answers for select
  using (public.user_has_grant_on_oracle(oracle_id));

-- And the beneficiary_rooms "grant-holders create rooms" policy
-- from 0039 also touches archive_grants — swap to the helper too.
drop policy if exists "grant-holders create rooms" on public.beneficiary_rooms;
create policy "grant-holders create rooms"
  on public.beneficiary_rooms for insert
  with check (
    auth.uid() = created_by_user_id
    and public.user_has_grant_on_oracle(oracle_id)
  );
