-- chapter3five — photos for thirtyfives + persisted chat history.

-- Photo URL on each oracle (and a copy on profiles for the active oracle).
alter table public.oracles
  add column if not exists avatar_url text;
alter table public.profiles
  add column if not exists avatar_url text;

-- messages: chat history, scoped per (user, oracle). Loaded on dashboard
-- mount, appended to on each chat round-trip.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_oracle_idx
  on public.messages (oracle_id, created_at);
create index if not exists messages_user_idx
  on public.messages (user_id);

alter table public.messages enable row level security;

create policy "messages: users read their own"
  on public.messages for select using (auth.uid() = user_id);

create policy "messages: users insert their own"
  on public.messages for insert with check (auth.uid() = user_id);

create policy "messages: users delete their own"
  on public.messages for delete using (auth.uid() = user_id);

-- Storage: avatars bucket. Public-read, user-only-write.
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "avatars: anyone read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: users upload their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: users update their own folder"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: users delete their own folder"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
