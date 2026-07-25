-- chapter3five — read receipts for the chat page (/chat/[id]).
--
-- The messages table (0011) already has everything the chat needs
-- (role check 'user'/'assistant', content, created_at, and the
-- (oracle_id, created_at) index) EXCEPT read state:
--
--   read_at            — when the USER saw a persona ('assistant')
--                        message. Set by /api/chat/[id]/messages/read
--                        when the chat page mounts / a reply lands.
--   read_by_oracle_at  — when the PERSONA "saw" a user message. Set
--                        by the stream route right before Claude
--                        starts generating a reply (that's the moment
--                        the persona has read you → ✓✓ on the bubble).
--
-- Both are written server-side with the service role after an
-- ownership check, so no new RLS policies are needed — users still
-- can't update message rows directly.

alter table public.messages
  add column if not exists read_at timestamptz,
  add column if not exists read_by_oracle_at timestamptz;

-- History query is (oracle_id, created_at) — already covered by
-- messages_oracle_idx from 0011. Kept here as a guard in case that
-- migration is ever pruned.
create index if not exists messages_oracle_idx
  on public.messages (oracle_id, created_at);
