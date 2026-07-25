-- 1. oracles.persona_prompt is server-side only. Application code already
--    treats it that way; enforce it at the grant level so the column is not
--    reachable from a client key. Server paths use the service role.
revoke select (persona_prompt) on public.oracles from anon, authenticated;

-- 2. Narrow three blanket read policies to the owner-scoped policies that
--    already exist alongside them on each table.
drop policy if exists "shares: authenticated lookup of active codes" on public.shares;
drop policy if exists "archive_invites: authenticated lookup" on public.archive_invites;
drop policy if exists "beneficiaries: token lookup" on public.beneficiaries;

-- 3. Clients insert their own turns only; assistant rows are written by the
--    server, and the target must be a conversation the caller can reach.
drop policy if exists "messages: users insert their own" on public.messages;
create policy "messages: users insert their own"
  on public.messages for insert
  with check (
    auth.uid() = user_id
    and role = 'user'
    and (
      public.user_owns_oracle(oracle_id)
      or public.user_has_share_on_oracle(oracle_id)
      or public.user_has_grant_on_oracle(oracle_id)
    )
  );

-- 4. Room membership was resolved by querying the same table from inside its
--    own policy, which recurses. Resolve it in a definer helper instead.
create or replace function public.user_in_beneficiary_room(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.beneficiary_room_members m
    where m.room_id = p_room
      and m.user_id = auth.uid()
      and m.left_at is null
  );
$$;

revoke execute on function public.user_in_beneficiary_room(uuid) from anon, authenticated;

drop policy if exists "members read their room membership" on public.beneficiary_room_members;
create policy "members read their room membership"
  on public.beneficiary_room_members for select
  using (user_id = auth.uid() or public.user_in_beneficiary_room(room_id));

drop policy if exists "members read room messages" on public.beneficiary_room_messages;
create policy "members read room messages"
  on public.beneficiary_room_messages for select
  using (public.user_in_beneficiary_room(room_id));

drop policy if exists "members read their rooms" on public.beneficiary_rooms;
create policy "members read their rooms"
  on public.beneficiary_rooms for select
  using (public.user_in_beneficiary_room(id));
