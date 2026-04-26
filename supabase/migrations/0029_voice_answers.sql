-- chapter3five — voice answers in the archive.
--
-- The killer chapter3five feature: record your ACTUAL VOICE answering
-- the 355 questions while you're alive. Years later, family asks the
-- archive a question and not only reads what you wrote — they hear you
-- say it. No other product does this.
--
-- Audio is stored alongside the text answer (not replacing it). The
-- text is what the AI sees; the audio is what humans listen to. Both
-- live on the answers row.

alter table public.answers
  add column if not exists audio_url text,
  add column if not exists audio_storage_path text,
  add column if not exists audio_duration_seconds int;

-- Storage: a private "archive-audio" bucket, same path shape as
-- chat-photos: <user_id>/<oracle_id>/<filename>. RLS policies below
-- give the owner full read/write/delete, and beneficiaries with an
-- archive_grant on the oracle get read access (they're the ones who
-- need to hear it).
insert into storage.buckets (id, name, public)
values ('archive-audio', 'archive-audio', false)
on conflict (id) do nothing;

drop policy if exists "archive-audio: owner reads" on storage.objects;
drop policy if exists "archive-audio: owner writes" on storage.objects;
drop policy if exists "archive-audio: owner deletes" on storage.objects;
drop policy if exists "archive-audio: beneficiary reads" on storage.objects;

create policy "archive-audio: owner reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'archive-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "archive-audio: owner writes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'archive-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "archive-audio: owner deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'archive-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Beneficiaries can read audio for any oracle they have a grant on.
-- The path layout `<owner_id>/<oracle_id>/<file>` lets us look up the
-- grant by checking foldername(name)[2] against archive_grants.
create policy "archive-audio: beneficiary reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'archive-audio'
    and exists (
      select 1
      from public.archive_grants g
      where g.user_id = auth.uid()
        and g.oracle_id::text = (storage.foldername(name))[2]
    )
  );
