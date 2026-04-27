-- Group chat — multiple identities + the user in one thread, talking
-- to each other and to the user the way a real group chat works.
--
-- A room is owned by one user. The user picks 2–4 of their own
-- oracles to put in the room. Each user message kicks an "urge"
-- pass for every member persona; whichever wants to respond actually
-- does. After the first reply, a second urge pass lets one persona
-- react to what another just said. Real-feeling turn-taking, not
-- "everyone replies to everything."

create table if not exists public.group_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create index if not exists group_rooms_owner_idx on public.group_rooms (owner_user_id, created_at desc);

create table if not exists public.group_room_members (
  room_id uuid not null references public.group_rooms(id) on delete cascade,
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- When a persona walks out of a group (e.g. doesn't get along with
  -- another member). Null = still in the room. Past timestamp = they
  -- left. Future iteration of group chat will populate this when
  -- urge-judge detects a personality clash.
  left_at timestamptz,
  left_reason text,
  primary key (room_id, oracle_id)
);

create index if not exists group_room_members_oracle_idx on public.group_room_members (oracle_id);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.group_rooms(id) on delete cascade,
  -- One of these is set: sender_oracle_id for a persona, sender_user_id
  -- for the human user. Constraint enforces exactly one.
  sender_oracle_id uuid references public.oracles(id) on delete set null,
  sender_user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  constraint sender_exactly_one check (
    (sender_oracle_id is not null and sender_user_id is null and role = 'assistant')
    or (sender_oracle_id is null and sender_user_id is not null and role = 'user')
  )
);

create index if not exists group_messages_room_idx on public.group_messages (room_id, created_at);

alter table public.group_rooms enable row level security;
alter table public.group_room_members enable row level security;
alter table public.group_messages enable row level security;

create policy "owner reads their rooms"
  on public.group_rooms
  for select
  using (auth.uid() = owner_user_id);

create policy "owner creates rooms"
  on public.group_rooms
  for insert
  with check (auth.uid() = owner_user_id);

create policy "owner updates their rooms"
  on public.group_rooms
  for update
  using (auth.uid() = owner_user_id);

create policy "owner deletes their rooms"
  on public.group_rooms
  for delete
  using (auth.uid() = owner_user_id);

create policy "owner reads room members"
  on public.group_room_members
  for select
  using (
    exists (
      select 1 from public.group_rooms r
      where r.id = group_room_members.room_id and r.owner_user_id = auth.uid()
    )
  );

create policy "owner adds room members"
  on public.group_room_members
  for insert
  with check (
    exists (
      select 1 from public.group_rooms r
      where r.id = group_room_members.room_id and r.owner_user_id = auth.uid()
    )
  );

create policy "owner removes room members"
  on public.group_room_members
  for delete
  using (
    exists (
      select 1 from public.group_rooms r
      where r.id = group_room_members.room_id and r.owner_user_id = auth.uid()
    )
  );

create policy "owner reads room messages"
  on public.group_messages
  for select
  using (
    exists (
      select 1 from public.group_rooms r
      where r.id = group_messages.room_id and r.owner_user_id = auth.uid()
    )
  );

-- Inserts go through the service role (the orchestration API).

-- Realtime so client gets new persona messages as they post.
alter publication supabase_realtime add table public.group_messages;
