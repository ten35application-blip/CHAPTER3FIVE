-- chapter3five — photo attachments on chat messages.
--
-- One-way: the user can attach a photo to a message they send. The
-- thirtyfive sees it (Anthropic vision) and reacts in character. We
-- never generate images. Photos persist with the message so they
-- survive across sessions, and get cleaned up when the message or
-- oracle is deleted.

alter table public.messages
  add column if not exists image_url text,
  add column if not exists image_storage_path text;

-- Storage: a private "chat-photos" bucket. Path layout is
-- <user_id>/<oracle_id>/<uuid>.<ext>. RLS via Supabase Storage policies
-- below ensures users can only read their own photos.
insert into storage.buckets (id, name, public)
values ('chat-photos', 'chat-photos', false)
on conflict (id) do nothing;

-- Storage policies: a user owns paths whose first folder == their uid.
drop policy if exists "chat-photos: owner reads" on storage.objects;
drop policy if exists "chat-photos: owner writes" on storage.objects;
drop policy if exists "chat-photos: owner deletes" on storage.objects;

create policy "chat-photos: owner reads"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "chat-photos: owner writes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "chat-photos: owner deletes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
