-- 0109_harden_messages_column_writes
--
-- Fable's audit (post-0108) surfaced four holes in the messages
-- table's security posture. Fix everything the auditor called out.
--
-- 1) enforce_message_soft_delete_only (from 0074) is SECURITY DEFINER
--    owned by postgres. Inside the function `current_user` always
--    resolves to postgres, so the
--    caller-in-('service_role','postgres','supabase_admin') gate
--    always short-circuits and the function is a no-op. Fable proved
--    this by UPDATEing read_by_oracle_at as the authenticated role.
--    Fix: replace with a caller-aware function that trusts the JWT
--    role claim (auth.role() / request.jwt.claim.role) — service_role
--    bypasses, everything else gets column-level enforcement.
--
-- 2) Column grants on messages are blanket: authenticated + anon hold
--    INSERT/UPDATE on every column. So even if the trigger worked, an
--    INSERT could pre-stamp read_by_oracle_at (the signal the earlier
--    fe4972b patch trusted). Fix: revoke everything, re-grant only
--    the narrow allowlist mapped from actual src/ usage.
--
-- 3) canSendMessageForTierCap counts via the user's client. Users
--    hold DELETE (via the `messages: users delete their own` policy)
--    and could set created_at at insert to reset the count. Fix:
--    revoke DELETE from authenticated + anon (soft-delete via UPDATE
--    deleted_at remains; the only hard-delete caller in src/ already
--    uses admin client — dashboard/actions.ts:187 purgeConversation)
--    and drop created_at from the INSERT allowlist so it always
--    defaults to now().
--
-- 4) One legit retry buys unlimited free re-rolls, bounded only by
--    the 200/day rate limit. Fix: add server-controlled retry_count
--    column; stream route increments via admin client and caps.
--
-- Usage map for the allowlist (grepped src/ before writing this):
--   INSERT (user client, api/chat/[id]/stream/route.ts:403):
--     user_id, oracle_id, role, content, image_url, image_storage_path
--   UPDATE (user client):
--     deleted_at  — dashboard/actions.ts:150 (soft delete)
--                   dashboard/actions.ts:169 (undo soft delete)
--     read_at     — chat/[id]/messages/read/route.ts:43 (client ack)
--   DELETE: none from user client
--
-- Server-controlled columns (blocked at INSERT + UPDATE for user
-- callers, always allowed for service_role):
--   id (default), created_at (default), read_by_oracle_at,
--   initiated_by, initiated_by_oracle (default false), retry_count
--   (default 0).

-- 1) drop the fake trigger + its function
drop trigger if exists messages_enforce_soft_delete_only on public.messages;
drop function if exists public.enforce_message_soft_delete_only();

-- 2) add retry_count column (server-controlled). Existing rows get 0.
alter table public.messages
  add column if not exists retry_count integer not null default 0;

-- 3) caller-aware enforcement function
create or replace function public.enforce_messages_column_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := nullif(current_setting('request.jwt.claim.role', true), '');
begin
  -- Fallback: auth.role() reads the same JWT claim through the wrapper.
  if jwt_role is null then
    begin
      jwt_role := auth.role();
    exception when others then
      jwt_role := null;
    end;
  end if;

  -- Server callers bypass.
  --   service_role  — JWT from a service-role key (webhooks, cron,
  --                   any route using createAdminClient)
  --   postgres etc. — direct DB (migrations, dashboard SQL editor);
  --                   session_user is authoritative because we cannot
  --                   fake it from a JWT
  if jwt_role = 'service_role'
     or session_user in ('postgres', 'supabase_admin', 'supabase_storage_admin')
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Every server-controlled column MUST equal its default here.
    -- Column-grant revoke below prevents most of these from being
    -- SETTABLE at all by user clients; the trigger is the belt for
    -- grant drift + defense against direct DB paths.
    if new.read_by_oracle_at is not null then
      raise exception 'messages: read_by_oracle_at is server-controlled'
        using errcode = '42501';
    end if;
    if new.deleted_at is not null then
      raise exception 'messages: deleted_at must be null at insert'
        using errcode = '42501';
    end if;
    if new.read_at is not null then
      raise exception 'messages: read_at is server-controlled at insert'
        using errcode = '42501';
    end if;
    if new.initiated_by is not null then
      raise exception 'messages: initiated_by is server-controlled'
        using errcode = '42501';
    end if;
    if new.initiated_by_oracle is distinct from false then
      raise exception 'messages: initiated_by_oracle is server-controlled'
        using errcode = '42501';
    end if;
    if new.retry_count is distinct from 0 then
      raise exception 'messages: retry_count is server-controlled'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Only deleted_at and read_at may change. Everything else must
    -- equal OLD.
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.oracle_id is distinct from old.oracle_id
       or new.role is distinct from old.role
       or new.content is distinct from old.content
       or new.created_at is distinct from old.created_at
       or new.image_url is distinct from old.image_url
       or new.image_storage_path is distinct from old.image_storage_path
       or new.read_by_oracle_at is distinct from old.read_by_oracle_at
       or new.initiated_by is distinct from old.initiated_by
       or new.initiated_by_oracle is distinct from old.initiated_by_oracle
       or new.retry_count is distinct from old.retry_count
    then
      raise exception 'messages: only deleted_at and read_at are user-writable'
        using errcode = '42501';
    end if;
    return new;
  end if;

  return new;
end;
$$;

create trigger messages_enforce_column_writes
  before insert or update on public.messages
  for each row execute function public.enforce_messages_column_writes();

-- 4) revoke blanket column grants (anon shouldn't have had any of
--    these — signed-in-only surface; revoke belt-and-suspenders)
revoke insert, update, delete on public.messages from anon;
revoke insert, update, delete on public.messages from authenticated;

-- 5) narrow allowlist for authenticated (anon gets nothing)
grant insert (user_id, oracle_id, role, content, image_url, image_storage_path)
  on public.messages to authenticated;
grant update (deleted_at, read_at) on public.messages to authenticated;
-- SELECT unchanged; RLS scopes to auth.uid() = user_id.

-- 6) drop the dead DELETE policy (the grant it depended on is gone)
drop policy if exists "messages: users delete their own" on public.messages;

-- 7) atomic retry-count bump RPC. Callable only by service_role;
--    stream route uses this to increment retry_count with cap check
--    in a single transaction (prevents the concurrent-retry race
--    where two clients both read the old count and each write count+1).
create or replace function public.bump_message_retry_count(
  target_message_id uuid,
  max_allowed integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.messages
    set retry_count = retry_count + 1
    where id = target_message_id
      and retry_count < max_allowed
    returning retry_count into new_count;
  return new_count;  -- null if no row was updated (cap hit or not found)
end;
$$;

revoke execute on function public.bump_message_retry_count(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.bump_message_retry_count(uuid, integer)
  to service_role;
