-- chapter3five — semantic memory retrieval via pgvector.
--
-- Currently we load the top 25 memories by weight on every chat turn.
-- That's fine when the persona has 30 memories. It breaks down when
-- the persona has 300 — the prompt loses focus, and the right memory
-- for *this* message gets buried by the high-weight identity facts.
--
-- This migration adds vector embeddings to persona_memories and an
-- IVFFLAT index for cosine-similarity search. The /api/chat route
-- embeds the user's incoming message and pulls the K most similar
-- memories instead of K highest weight. Result: persona surfaces the
-- right memory at the right moment, even with thousands recorded.
--
-- Embedding model: OpenAI text-embedding-3-small (1536 dims, cheap).
-- See src/lib/embeddings.ts. Existing memories without embeddings
-- fall back to weight-based retrieval cleanly.

-- pgvector — Supabase has this available; this just enables it for
-- the project. If "extension already exists" it's a no-op.
create extension if not exists vector;

alter table public.persona_memories
  add column if not exists embedding vector(1536);

-- IVFFLAT index for fast approximate nearest-neighbor search.
-- lists=100 is a sane default for tables up to ~100k rows.
-- Cosine distance (vector_cosine_ops) is what we'll query with.
create index if not exists persona_memories_embedding_idx
  on public.persona_memories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RPC for similarity search. Returns the top-K memories for a
-- (oracle, user) pair, ordered by cosine distance to the supplied
-- query embedding. We expose this as an RPC so we can call it from
-- the API without doing raw SQL through the client.
create or replace function public.match_persona_memories(
  query_embedding vector(1536),
  target_oracle_id uuid,
  target_user_id uuid,
  match_count int default 25
)
returns table (
  id uuid,
  kind text,
  content text,
  weight float,
  similarity float
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    pm.id,
    pm.kind,
    pm.content,
    pm.weight,
    1 - (pm.embedding <=> query_embedding) as similarity
  from public.persona_memories pm
  where pm.oracle_id = target_oracle_id
    and pm.user_id = target_user_id
    and pm.embedding is not null
  order by pm.embedding <=> query_embedding
  limit match_count;
end;
$$;

revoke all on function public.match_persona_memories(
  vector(1536), uuid, uuid, int
) from public;
revoke all on function public.match_persona_memories(
  vector(1536), uuid, uuid, int
) from anon;
revoke all on function public.match_persona_memories(
  vector(1536), uuid, uuid, int
) from authenticated;
