-- 0108_messages_insert_allows_concierge
--
-- The `messages: users insert their own` RLS policy (from 0055-era)
-- gates user-role INSERTs on the ownership + share + grant checks --
-- none of which cover the concierge (Adrian). Result: every free /
-- basic / pro user's FIRST message to Adrian 403s at the DB layer,
-- and the client shows "lost the thread for a second. Retry" -- and
-- Retry can't fix it because retry just regenerates the persona
-- reply, doesn't retry inserting the user turn.
--
-- Same class of miss as the canChatWithOracle fix (c41aed2): we
-- handled the READ surface (added a concierge branch), forgot the
-- WRITE surface. This migration adds `is_concierge = true` to the
-- INSERT policy's OR chain so users can send messages to Adrian.
--
-- Everything else about the policy is preserved:
--   auth.uid() = user_id     — you can only insert your own rows
--   role = 'user'            — clients can't fake assistant turns
--   ownership / share / grant — the existing paths for personas the
--                               user built or redeemed a code for
--
-- Idempotent: drops the old policy + recreates.

drop policy if exists "messages: users insert their own" on public.messages;

create policy "messages: users insert their own"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and role = 'user'
    and (
      user_owns_oracle(oracle_id)
      or user_has_share_on_oracle(oracle_id)
      or user_has_grant_on_oracle(oracle_id)
      or exists (
        select 1 from public.oracles o
        where o.id = oracle_id
          and o.is_concierge = true
      )
    )
  );
