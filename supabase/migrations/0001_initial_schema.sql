-- chapter3five — initial schema
-- Apply via Supabase Studio → SQL Editor → New query → Run.
-- Or via supabase CLI: `supabase db push` after `supabase link`.

-- ============================================================================
-- profiles: extends auth.users with chapter3five-specific data
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'es')),
  texting_style text,         -- captured early to make replies sound like them
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles: users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile row when a new auth.users row is inserted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- answers: the recorded responses to the 355 questions
--
-- Each question can have up to 3 answer variants per user. The chat surface
-- randomly picks one variant at generation time so the archive never feels
-- repetitive — same person, different moods.
-- ============================================================================
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id integer not null,
  language text not null check (language in ('en', 'es')),
  variant smallint not null default 1 check (variant between 1 and 3),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id, variant)
);

create index if not exists answers_user_idx on public.answers (user_id);
create index if not exists answers_user_question_idx on public.answers (user_id, question_id);

alter table public.answers enable row level security;

create policy "answers: users can read their own answers"
  on public.answers for select
  using (auth.uid() = user_id);

create policy "answers: users can insert their own answers"
  on public.answers for insert
  with check (auth.uid() = user_id);

create policy "answers: users can update their own answers"
  on public.answers for update
  using (auth.uid() = user_id);

create policy "answers: users can delete their own answers"
  on public.answers for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- agreements: log of which legal docs a user accepted, when, and what version
-- ============================================================================
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document text not null check (document in ('terms', 'privacy', 'cookies')),
  version text not null,                 -- e.g. "2026-04-25"
  accepted_at timestamptz not null default now(),
  unique (user_id, document, version)
);

create index if not exists agreements_user_idx on public.agreements (user_id);

alter table public.agreements enable row level security;

create policy "agreements: users can read their own agreements"
  on public.agreements for select
  using (auth.uid() = user_id);

create policy "agreements: users can insert their own agreements"
  on public.agreements for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- waitlist: pre-launch email capture (no auth required)
-- ============================================================================
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  preferred_language text default 'en' check (preferred_language in ('en', 'es')),
  source text,                          -- where they signed up from
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

-- Allow anonymous inserts only — never reads.
create policy "waitlist: anyone can sign up"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

-- ============================================================================
-- updated_at auto-touch trigger
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists answers_touch_updated_at on public.answers;
create trigger answers_touch_updated_at
  before update on public.answers
  for each row execute function public.touch_updated_at();
