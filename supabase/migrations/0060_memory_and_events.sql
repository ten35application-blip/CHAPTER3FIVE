-- ============================================================================
-- 0060_memory_and_events.sql — formula v4: long-term memory + life events
--
-- 1. persona_memories v2. The 0019 table (kind/content/weight, plus the
--    0027 embedding column) never shipped a writer — the table has zero
--    rows in every environment — and formula v4 locks a different
--    contract: stable slug keys ("spouse_name", "kid_1_birthday") with
--    plain-text values and a 1-10 importance, deduped per
--    (oracle_id, user_id, key) so the extractor can upsert.
--
--    Deliberately FULLY ADDITIVE: the v2 columns/indexes/policies are added
--    alongside the unused 0019 columns rather than dropping them (kind/
--    content lose their NOT NULL so v2-shape inserts succeed). Nothing is
--    dropped; a later cleanup migration can retire the dead columns once
--    v4 has soaked.
--
-- 2. oracles.significant_events — jsonb array of 3-5 events, each
--    { ageAtEvent: number, summary: string }. Written at synthesis time by
--    synthesizePersona; the persona_prompt references them in its
--    "What I've lived through" section.
--
-- 3. oracles.creation_source — how this identity came to exist:
--      'random' → the /identity/new formula roll (default, covers backfill)
--      'photo'  → /identity/from-photo (user upload IS the avatar; no Flux)
--      'legacy' → the legacy-mode path (backfilled from is_legacy)
--
-- Storage note for the photo path: uploads to avatars/user-uploaded/* are
-- written by the SERVICE-ROLE client from the server action (service role
-- bypasses storage RLS, same as generated faces in 0058), so 0011's
-- per-user-folder write policies need no changes.
--
-- Idempotent. Safe to run twice. Applied to the live DB 2026-07-24.
-- ============================================================================

-- Fresh environments where 0019 never ran: create the table in its final
-- shape directly. Existing environments: no-op (0019's table is present).
create table if not exists public.persona_memories (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  importance int not null default 5 check (importance between 1 and 10),
  source text check (source in ('user_stated', 'extracted', 'manual')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- v2 columns for environments that already have the 0019 table.
alter table public.persona_memories
  add column if not exists key text not null,
  add column if not exists value text not null,
  add column if not exists importance int not null default 5
    check (importance between 1 and 10),
  add column if not exists source text
    check (source in ('user_stated', 'extracted', 'manual'));

-- The 0019 columns (kind, content) were NOT NULL; relax them so v2-shape
-- inserts succeed. No data exists, so this changes nothing stored.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'persona_memories'
      and column_name = 'kind'
  ) then
    alter table public.persona_memories alter column kind drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'persona_memories'
      and column_name = 'content'
  ) then
    alter table public.persona_memories alter column content drop not null;
  end if;
end $$;

-- One value per fact per relationship — the extractor upserts on this.
create unique index if not exists persona_memories_oracle_user_key_idx
  on public.persona_memories (oracle_id, user_id, key);

-- Retrieval path: top-N by importance for a pair.
create index if not exists persona_memories_retrieval_idx
  on public.persona_memories (oracle_id, user_id, importance desc, updated_at desc);

alter table public.persona_memories enable row level security;

-- 0019 already ships identical select/update/delete policies for the user's
-- own rows; only the insert policy is new. Guarded so reruns are no-ops.
-- Extraction writes come from the server via the service role, which
-- bypasses RLS entirely — no policy needed for that path.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'persona_memories'
      and policyname = 'persona_memories: user reads own'
  ) then
    create policy "persona_memories: user reads own"
      on public.persona_memories for select
      using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'persona_memories'
      and policyname = 'persona_memories: user inserts own'
  ) then
    create policy "persona_memories: user inserts own"
      on public.persona_memories for insert
      with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'persona_memories'
      and policyname = 'persona_memories: user updates own'
  ) then
    create policy "persona_memories: user updates own"
      on public.persona_memories for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'persona_memories'
      and policyname = 'persona_memories: user deletes own'
  ) then
    create policy "persona_memories: user deletes own"
      on public.persona_memories for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. oracles.significant_events
-- ---------------------------------------------------------------------------

alter table public.oracles
  add column if not exists significant_events jsonb;

comment on column public.oracles.significant_events is
  'Array of 3-5 synthesized life events, each { ageAtEvent: number, '
  'summary: string }. Generated by synthesizePersona alongside the '
  'persona_prompt; null for personas synthesized before formula v4.';

-- ---------------------------------------------------------------------------
-- 3. oracles.creation_source
-- ---------------------------------------------------------------------------

alter table public.oracles
  add column if not exists creation_source text
    check (creation_source in ('random', 'photo', 'legacy'))
    default 'random';

-- Backfill: legacy-mode identities are identifiable via is_legacy.
update public.oracles
  set creation_source = 'legacy'
  where is_legacy = true
    and (creation_source is null or creation_source = 'random');

comment on column public.oracles.creation_source is
  'How the identity was created: random (formula roll), photo '
  '(user-uploaded photo seeded the traits; the upload is the avatar), '
  'legacy (legacy preservation mode).';
