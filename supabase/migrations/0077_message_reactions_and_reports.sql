-- 0077_message_reactions_and_reports
--
-- Two new tables for chat interactions modeled after iMessage-style
-- tapbacks and Apple-required UGC report flow.
--
-- message_reactions (NEW):
--   Bidirectional. User reacts to any message in their own thread.
--   Personas react to user messages via server-side inserts.
--   Exactly one of user_id / oracle_id is set on each row (CHECK).
--   One reaction per actor per message (partial unique indexes) —
--   changing your reaction upserts; tapping the same one twice
--   is a client-side delete.
--
-- message_reports (REDESIGNED):
--   Legacy table (empty, unshipped) used a free-form message_content
--   string with no foreign key. Redesigned here to reference messages.id
--   directly, add a status/review workflow, and enum-constrain the
--   reason. Callers updated in the same commit.
--   User can report ANY message in their own thread. Reports land in
--   a moderation queue on /admin/reports. App Store review requires
--   this surface.

-- Drop the legacy report table so we can recreate with the new shape.
-- Safe because zero rows have ever landed (verified) and the three
-- callers are being updated in this same commit.
drop table if exists public.message_reports cascade;

-- ============================================================
-- message_reactions
-- ============================================================

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  oracle_id uuid references public.oracles(id) on delete cascade,
  kind text not null check (
    kind in ('heart', 'exclamation', 'thumbs_up', 'thumbs_down', 'question', 'ha_ha')
  ),
  created_at timestamptz not null default now(),
  -- Exactly one actor. NEVER both, NEVER neither.
  constraint reaction_one_actor check ((user_id is not null) <> (oracle_id is not null))
);

create unique index message_reactions_user_unique_idx
  on public.message_reactions (message_id, user_id)
  where user_id is not null;

create unique index message_reactions_oracle_unique_idx
  on public.message_reactions (message_id, oracle_id)
  where oracle_id is not null;

create index message_reactions_message_idx
  on public.message_reactions (message_id, created_at);

alter table public.message_reactions enable row level security;

-- User can read reactions on any message belonging to their own thread.
create policy "reactions: user reads own-thread reactions"
  on public.message_reactions
  for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and m.user_id = auth.uid()
    )
  );

-- User can insert their own reactions on their own-thread messages.
create policy "reactions: user inserts own"
  on public.message_reactions
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and m.user_id = auth.uid()
    )
  );

-- User can delete their own reactions.
create policy "reactions: user deletes own"
  on public.message_reactions
  for delete
  using (user_id = auth.uid());

grant select, insert, delete on public.message_reactions to authenticated;

-- ============================================================
-- message_reports (redesigned)
-- ============================================================

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in ('inappropriate', 'harmful', 'off_character', 'spam', 'other')
  ),
  notes text,
  status text not null default 'pending' check (
    status in ('pending', 'reviewed', 'dismissed')
  ),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index message_reports_status_idx
  on public.message_reports (status, created_at desc);

create index message_reports_message_idx
  on public.message_reports (message_id);

alter table public.message_reports enable row level security;

-- User can insert reports for messages in their own thread.
create policy "reports: user reports own-thread messages"
  on public.message_reports
  for insert
  with check (
    reporter_user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reports.message_id
        and m.user_id = auth.uid()
    )
  );

-- User can see their own submitted reports.
create policy "reports: user reads own reports"
  on public.message_reports
  for select
  using (reporter_user_id = auth.uid());

-- No user UPDATE / DELETE — resolution is admin-only via service role.

grant select, insert on public.message_reports to authenticated;
