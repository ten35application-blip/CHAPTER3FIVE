-- 0076: conversation-scoped archive + private profile-avatars bucket.
--
-- Two independent fixes bundled into one migration:
--
-- 1. Rename oracles.archived_at → conversation_archived_at.
--    0074 shipped an "archive" that removed the identity from BOTH the
--    dashboard AND the contact list. Wilson's product rule (per his
--    exact words): "identities should NEVER leave your contact list
--    unless you delete them." Archive = hide the CONVERSATION from the
--    Messages inbox; the identity stays visible in Contacts. Rename the
--    column so the semantics can't be mis-read again — the old name
--    misled the earlier pass into treating this as identity-level.
--    Column-level SELECT grant, index, and comment follow the rename.
--
-- 2. Private profile-avatars bucket for the user's own profile photo.
--    profiles.avatar_url already exists (0011). The bucket is new,
--    holds ONE processed jpeg per user at {user_id}/avatar.jpg (server
--    resizes + re-encodes; see settings/profile/actions.ts). Bucket is
--    private — client reads via short-lived signed URLs minted server
--    side. Owner-scoped SELECT/INSERT/UPDATE/DELETE mirror the
--    chat-uploads pattern (0061).
--
-- Every statement is idempotent — this repo applies migrations to a
-- shared remote instance where a partial re-run must be a no-op.

-- ============================================================================
-- 1. oracles.archived_at → oracles.conversation_archived_at
-- ============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'oracles'
      and column_name = 'archived_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'oracles'
      and column_name = 'conversation_archived_at'
  ) then
    alter table public.oracles
      rename column archived_at to conversation_archived_at;
  end if;
end $$;

-- Fresh environments that never had 0074 applied: add the column
-- directly. The DO block above is a no-op when the source column
-- doesn't exist, so this covers both paths.
alter table public.oracles
  add column if not exists conversation_archived_at timestamptz;

comment on column public.oracles.conversation_archived_at is
  'When the owner archived their CONVERSATION with this identity. Nullable = conversation is active on the dashboard. Archive hides the thread from the Messages inbox; the identity itself STAYS in Contacts. Restore is free and clears this column.';

-- The rename brought grants along. On fresh envs (column added just
-- above), the client roles need SELECT on the new column so
-- Contacts/Archived queries can filter by it.
grant select (conversation_archived_at)
  on public.oracles to anon, authenticated;

-- Index — rename to match the column, or create fresh on a new env.
alter index if exists public.oracles_archived_at_idx
  rename to oracles_conversation_archived_at_idx;

create index if not exists oracles_conversation_archived_at_idx
  on public.oracles (user_id, conversation_archived_at)
  where conversation_archived_at is not null;

-- ============================================================================
-- 2. profile-avatars bucket (private) + owner-scoped policies
-- ============================================================================

-- profiles.avatar_url is already on the table since 0011 — no column
-- work needed here. The user's own row is guarded by the existing
-- "profiles: users can update their own profile" policy (0001); the
-- billing-column trigger (0065/0073) doesn't police avatar_url, so
-- setting it via the standard authenticated client is allowed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

drop policy if exists "profile-avatars: owner reads" on storage.objects;
drop policy if exists "profile-avatars: owner writes" on storage.objects;
drop policy if exists "profile-avatars: owner updates" on storage.objects;
drop policy if exists "profile-avatars: owner deletes" on storage.objects;

create policy "profile-avatars: owner reads"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile-avatars: owner writes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile-avatars: owner updates"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile-avatars: owner deletes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
