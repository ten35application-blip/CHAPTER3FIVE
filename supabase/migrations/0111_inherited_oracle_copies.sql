-- ============================================================================
-- 0111_inherited_oracle_copies.sql
--
-- Redemption model change: redeeming an inherit code now DUPLICATES the
-- legacy oracle into the recipient's account (frozen snapshot of name,
-- hook, persona_prompt, traits, legacy_answers + a copied avatar file)
-- instead of inserting an oracle_shares row that points at the creator's
-- row. The recipient's copy is fully theirs: the creator deleting their
-- account, their oracle, or their storage objects can never take the
-- person away from the family again.
--
--   1. oracles gains inherited_from_code_id (best-effort provenance FK,
--      nulls out if the code row ever goes away) and inherited_at (the
--      DURABLE marker -- survives creator account deletion, which
--      cascades inherit_codes away). App logic keys off inherited_at.
--   2. Read grants for the two new columns (column-list model from 0070;
--      new columns are not covered by the old grants). NO insert/update
--      grant -- PostgREST roles can never set or clear the markers.
--   3. protect_oracle_state extended so the markers are also
--      trigger-protected (belt on top of the missing grants).
--   4. The 0055 share-row plumbing is retired: both oracle_shares and
--      inherit_codes hold zero rows in production (verified 2026-07-28),
--      so no backfill is needed and nothing user-visible changes.
--      Dropping the cross-user read policy + SECURITY DEFINER helper
--      removes an entire unused authorization surface.
--
-- Fingerprint note: the unique index oracles_fingerprint_key stays.
-- Redemption copies get a fingerprint derived from the source
-- fingerprint salted with the recipient's user id -- deterministic, so
-- a second copy attempt by the same recipient collides with their own
-- first copy (DB-level double-redeem stop) while never colliding with
-- the creator's row.
--
-- Idempotent. Safe to run twice.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Provenance columns
-- ----------------------------------------------------------------------------
alter table public.oracles
  add column if not exists inherited_from_code_id uuid
    references public.inherit_codes(id) on delete set null,
  add column if not exists inherited_at timestamptz;

-- Redemption's "did this user already redeem this code?" lookup.
create index if not exists oracles_inherited_code_idx
  on public.oracles (inherited_from_code_id, user_id)
  where inherited_from_code_id is not null;

-- ----------------------------------------------------------------------------
-- 2. Column grants: read-only for PostgREST roles. The 0070 column-list
--    model means new columns arrive with NO grants at all; without this
--    any user SELECT naming inherited_at would 42501 the whole query.
--    Deliberately no INSERT/UPDATE grant -- only the service-role
--    redemption action writes these.
-- ----------------------------------------------------------------------------
grant select (inherited_from_code_id, inherited_at)
  on public.oracles to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Trigger belt: even if a future migration re-grants broad writes,
--    user-role INSERT/UPDATE can never forge or clear the inherited
--    markers. Mirrors the live 0091/0093 definition exactly, plus the
--    two new columns.
-- ----------------------------------------------------------------------------
create or replace function public.protect_oracle_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text := coalesce(
    current_setting('role', true),
    session_user::text
  );
begin
  if role_name not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.blocked_at is not null
       or new.block_reason is not null
       or new.deleted_at is not null
       or new.scheduled_purge_at is not null
       or coalesce(new.is_legacy, false) = true
       or new.creation_source is not null
       or new.inherited_from_code_id is not null
       or new.inherited_at is not null then
      raise exception 'oracles: state columns are not user-writable'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.blocked_at is distinct from old.blocked_at
    or new.block_reason is distinct from old.block_reason
    or new.scheduled_purge_at is distinct from old.scheduled_purge_at
    or new.is_legacy is distinct from old.is_legacy
    or new.creation_source is distinct from old.creation_source
    or new.fingerprint is distinct from old.fingerprint
    or new.user_id is distinct from old.user_id
    or new.inherited_from_code_id is distinct from old.inherited_from_code_id
    or new.inherited_at is distinct from old.inherited_at
  then
    raise exception 'oracles: state columns are not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Retire the 0055 share-row model. Order matters: the messages INSERT
--    policy references user_has_share_on_oracle, which references
--    oracle_shares -- unwind policy -> oracles policy -> function -> table.
--
--    The recreated messages policy keeps every other leg intact:
--      auth.uid() = user_id      -- only your own rows
--      role = 'user'             -- clients can't fake assistant turns
--      user_owns_oracle          -- personas you own, INCLUDING inherited
--                                   copies (they're owned rows now)
--      user_has_grant_on_oracle  -- posthumous beneficiary claims (0014)
--      is_concierge              -- Adrian (0108)
-- ----------------------------------------------------------------------------
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
      or user_has_grant_on_oracle(oracle_id)
      or exists (
        select 1 from public.oracles o
        where o.id = oracle_id
          and o.is_concierge = true
      )
    )
  );

drop policy if exists "oracles: recipients read via share" on public.oracles;

drop function if exists public.user_has_share_on_oracle(uuid);

drop table if exists public.oracle_shares;
