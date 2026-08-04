-- 0130_with_check_on_reassignable_updates
--
-- Applied to the remote project 2026-08-04.
--
-- Nine UPDATE policies had USING with no WITH CHECK. Paired with
-- table-level column grants, that means a row can be updated INTO a
-- state the user could never have created. Most were contained by a
-- protection trigger; four tables had no trigger at all.
--
-- THE ONE THAT MATTERED: `answers`. RLS is USING(auth.uid() = user_id)
-- with a table-level UPDATE grant on all 11 columns and NO protection
-- trigger. So:
--
--   PATCH /rest/v1/answers?id=eq.<my_own_row>
--   {"oracle_id":"<victim_oracle>","user_id":"<victim_user>"}
--
-- passes USING (the attacker genuinely owns the row) and nothing
-- validated the resulting state. The attacker's own text lands inside
-- another family's memorial archive, attributed to their deceased
-- relative — and `answers` has a SELECT policy for
-- user_has_grant_on_oracle, so every beneficiary of that archive would
-- see it. Content injection into someone else's grief.
--
-- Dormant today (0 rows, feature unused) but reachable by anyone with
-- the public anon key, which is why it is closed now rather than when
-- the feature ships.
--
-- legacy_drafts / archive_invites / shares are the same shape with no
-- trigger; all three are 0 rows today.
--
-- The storage pair is the same omission: the INSERT policies on
-- `avatars` and `profile-avatars` correctly carry WITH CHECK, the
-- UPDATE policies never got the matching clause. Without it a user can
-- UPDATE a storage row they own and rewrite `name` into another user's
-- folder, planting or displacing a file there.
--
-- Idempotent: drop-if-exists then recreate.

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname='public' and tablename='answers' and cmd='UPDATE'
  loop
    execute format('drop policy if exists %I on public.answers', pol.policyname);
  end loop;
end $$;

create policy "answers: owner updates own"
  on public.answers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname='public' and tablename='legacy_drafts' and cmd='UPDATE'
  loop
    execute format('drop policy if exists %I on public.legacy_drafts', pol.policyname);
  end loop;
end $$;

create policy "legacy_drafts: owner updates own"
  on public.legacy_drafts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname='public' and tablename='archive_invites' and cmd='UPDATE'
  loop
    execute format('drop policy if exists %I on public.archive_invites', pol.policyname);
  end loop;
end $$;

create policy "archive_invites: inviter updates own"
  on public.archive_invites for update
  using (auth.uid() = inviter_user_id)
  with check (auth.uid() = inviter_user_id);

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname='public' and tablename='shares' and cmd='UPDATE'
  loop
    execute format('drop policy if exists %I on public.shares', pol.policyname);
  end loop;
end $$;

create policy "shares: source updates own"
  on public.shares for update
  using (auth.uid() = source_user_id)
  with check (auth.uid() = source_user_id);

drop policy if exists "avatars: users update their own folder" on storage.objects;
create policy "avatars: users update their own folder"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile-avatars: owner updates" on storage.objects;
create policy "profile-avatars: owner updates"
  on storage.objects for update
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
