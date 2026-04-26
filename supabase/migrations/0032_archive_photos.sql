-- chapter3five — photos attached to specific archive answers.
--
-- Each answer (text + voice + now photo) becomes a heirloom-grade
-- artifact: question, what you wrote, what you said out loud, what
-- you looked like / what the place looked like / who they were.
--
-- Storage layout matches archive-audio: <user_id>/<oracle_id>/
-- <question_id>.<ext>. Beneficiaries get read access via the same
-- archive_grants check.

alter table public.answers
  add column if not exists photo_url text,
  add column if not exists photo_storage_path text;

insert into storage.buckets (id, name, public)
values ('archive-photos', 'archive-photos', false)
on conflict (id) do nothing;

drop policy if exists "archive-photos: owner reads" on storage.objects;
drop policy if exists "archive-photos: owner writes" on storage.objects;
drop policy if exists "archive-photos: owner deletes" on storage.objects;
drop policy if exists "archive-photos: beneficiary reads" on storage.objects;

create policy "archive-photos: owner reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'archive-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "archive-photos: owner writes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'archive-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "archive-photos: owner deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'archive-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "archive-photos: beneficiary reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'archive-photos'
    and exists (
      select 1
      from public.archive_grants g
      where g.user_id = auth.uid()
        and g.oracle_id::text = (storage.foldername(name))[2]
    )
  );
