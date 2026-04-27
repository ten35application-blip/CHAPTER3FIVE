-- Beneficiary group rooms — multiple beneficiaries of the same
-- archive in one thread with the deceased persona. Different shape
-- from owner group_rooms (which contain multiple oracles + one user).
-- Here: ONE oracle (the deceased archive) + multiple users (the
-- beneficiaries who loved them).
--
-- Use case: siblings who both inherited their mom's archive can sit
-- with her together, see each other's messages, hear her respond to
-- both. Each beneficiary's 1:1 conversations stay private; this is
-- explicit shared-grief space.
--
-- Permission: any user with an archive_grant on the oracle can create
-- a room and invite other grant-holders. Memorial mode is forced on
-- (these are deceased archives by definition; living archives get
-- 1:1 only).

create table if not exists public.beneficiary_rooms (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create index if not exists beneficiary_rooms_oracle_idx on public.beneficiary_rooms (oracle_id);
create index if not exists beneficiary_rooms_creator_idx on public.beneficiary_rooms (created_by_user_id);

create table if not exists public.beneficiary_room_members (
  room_id uuid not null references public.beneficiary_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id)
);

create index if not exists beneficiary_room_members_user_idx on public.beneficiary_room_members (user_id);

create table if not exists public.beneficiary_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.beneficiary_rooms(id) on delete cascade,
  -- Exactly one is set: sender_user_id for a beneficiary, sender_oracle_id
  -- for the deceased persona's reply.
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_oracle_id uuid references public.oracles(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  constraint beneficiary_sender_exactly_one check (
    (sender_user_id is not null and sender_oracle_id is null and role = 'user')
    or (sender_user_id is null and sender_oracle_id is not null and role = 'assistant')
  )
);

create index if not exists beneficiary_room_messages_room_idx
  on public.beneficiary_room_messages (room_id, created_at);

alter table public.beneficiary_rooms enable row level security;
alter table public.beneficiary_room_members enable row level security;
alter table public.beneficiary_room_messages enable row level security;

-- A user can read a room IFF they are a member of it. Membership is
-- the only gate — we don't double-check the archive_grant on every
-- read because being added to the room already required the inviter
-- to have a grant.
create policy "members read their rooms"
  on public.beneficiary_rooms
  for select
  using (
    exists (
      select 1 from public.beneficiary_room_members m
      where m.room_id = beneficiary_rooms.id
        and m.user_id = auth.uid()
        and m.left_at is null
    )
  );

-- Creating a room requires the caller to have a grant on the target
-- oracle. The orchestration API enforces this AND that the oracle's
-- owner is deceased.
create policy "grant-holders create rooms"
  on public.beneficiary_rooms
  for insert
  with check (
    auth.uid() = created_by_user_id
    and exists (
      select 1 from public.archive_grants g
      where g.oracle_id = beneficiary_rooms.oracle_id
        and g.user_id = auth.uid()
    )
  );

create policy "members read their room membership"
  on public.beneficiary_room_members
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.beneficiary_room_members self
      where self.room_id = beneficiary_room_members.room_id
        and self.user_id = auth.uid()
        and self.left_at is null
    )
  );

create policy "members read room messages"
  on public.beneficiary_room_messages
  for select
  using (
    exists (
      select 1 from public.beneficiary_room_members m
      where m.room_id = beneficiary_room_messages.room_id
        and m.user_id = auth.uid()
        and m.left_at is null
    )
  );

-- Inserts go through service role from the orchestration API.

-- Realtime so all members see new messages live.
alter publication supabase_realtime add table public.beneficiary_room_messages;
alter publication supabase_realtime add table public.beneficiary_room_members;
