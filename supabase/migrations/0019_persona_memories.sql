-- chapter3five — persona memory ("what the thirtyfive remembers about you").
--
-- Separate from messages: messages are the raw transcript (what you can
-- delete), memories are the extracted *facts* the persona keeps about each
-- relationship. Even if you wipe the conversation, the persona still
-- remembers your daughter's name, that your dad died last year, what you
-- were chewing over the last time you talked. That's what makes the
-- thirtyfive feel like someone who knows you, not a chatbot that resets
-- every time.
--
-- Per-relationship: (oracle_id, user_id) is the key. Mom remembers Sarah
-- one way, Sarah's husband another way. The same persona, different
-- relationships, different memories.

create table if not exists public.persona_memories (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null
    check (kind in ('fact', 'relationship', 'preference', 'event', 'topic', 'feeling')),
  content text not null,
  source_message_ids uuid[],     -- traceable but not FK; messages may be deleted
  weight float not null default 1.0,
  last_referenced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists persona_memories_oracle_user_idx
  on public.persona_memories (oracle_id, user_id);
create index if not exists persona_memories_weight_idx
  on public.persona_memories (oracle_id, user_id, weight desc);

alter table public.persona_memories enable row level security;

drop policy if exists "persona_memories: user reads own" on public.persona_memories;
drop policy if exists "persona_memories: oracle owner reads" on public.persona_memories;
drop policy if exists "persona_memories: user deletes own" on public.persona_memories;
drop policy if exists "persona_memories: user updates own" on public.persona_memories;

-- The user in the relationship can read their own memories ("what does
-- mom remember about me?") and delete them (privacy control).
create policy "persona_memories: user reads own"
  on public.persona_memories for select
  using (auth.uid() = user_id);

-- The oracle's owner can also read all memories on their oracle (so the
-- person being preserved can see what's been recorded about each
-- relationship).
create policy "persona_memories: oracle owner reads"
  on public.persona_memories for select
  using (
    exists (
      select 1 from public.oracles o
      where o.id = persona_memories.oracle_id
        and o.user_id = auth.uid()
    )
  );

create policy "persona_memories: user deletes own"
  on public.persona_memories for delete
  using (auth.uid() = user_id);

create policy "persona_memories: user updates own"
  on public.persona_memories for update
  using (auth.uid() = user_id);

-- Inserts come from the server (extractor) via service role only.
