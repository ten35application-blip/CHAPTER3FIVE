-- 0074: two deletion trails.
--
-- 1. Identity-level archive (free, reversible) + per-oracle restore price.
-- 2. Conversation-level soft-delete on messages (free trail: recover /
--    hard-delete).
--
-- Product mental model:
--   Dashboard = Messages app; swipe row → Archive (free) or Delete
--   conversation (free — the thread's messages get deleted_at set;
--   contact stays in the directory).
--   Contacts = directory; swipe row → Delete identity ($5 to restore,
--   conversation preserved on restore).
--
-- Every statement is idempotent: this repo applies migrations to a
-- shared remote instance where a partial re-run must be a no-op.

-- ============================================================================
-- 1. oracles.archived_at + restore price
-- ============================================================================

alter table public.oracles
  add column if not exists archived_at timestamptz;

alter table public.oracles
  add column if not exists restore_price_cents integer not null default 500
    check (restore_price_cents >= 0);

comment on column public.oracles.archived_at is
  'When the owner archived this identity. Nullable = active. Archive hides from dashboard but keeps chat history and allows free restore.';
comment on column public.oracles.restore_price_cents is
  'Paid restore price for this identity, USD cents. Mirrors PRICING.restoreIdentityCents at creation time.';

create index if not exists oracles_archived_at_idx
  on public.oracles (user_id, archived_at)
  where archived_at is not null;

-- Column-level grants — 0070 revoked the table-wide select, so every
-- new column needs an explicit grant.
grant select (archived_at, restore_price_cents)
  on public.oracles to anon, authenticated;

-- ============================================================================
-- 2. messages.deleted_at — conversation-level soft-delete
-- ============================================================================

alter table public.messages
  add column if not exists deleted_at timestamptz;

comment on column public.messages.deleted_at is
  'When the user soft-deleted this message. Nullable = active. Deleting a whole conversation sets this on every message in the thread; recovering clears it. Hard-delete removes the row entirely and is a service-role-only path.';

-- Fast lookup for the dashboard filter ("hide oracles whose whole
-- thread is soft-deleted") and the trash sub-panel counts.
create index if not exists messages_user_oracle_deleted_idx
  on public.messages (user_id, oracle_id, deleted_at);

-- The 0011 policy set allowed users to SELECT / INSERT / DELETE their
-- own messages. Add UPDATE, narrowly — a user can only flip their own
-- row's deleted_at (both set-to-now and clear-to-null). Content, role,
-- oracle_id, user_id cannot be altered from a client key.
--
-- Trigger enforces a positive allowlist: deleted_at is the ONLY column
-- a non-service-role caller may change. Read receipts, image paths,
-- initiated-by-oracle, content — everything else stays server-only,
-- matching the 0059 comment that read state is service-role writes.
create or replace function public.enforce_message_soft_delete_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller text := current_user::text;
  new_row public.messages;
begin
  if caller in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  -- Rebuild a "would-be new row" that only differs in deleted_at.
  -- If new IS DISTINCT FROM that, some other column changed — reject.
  new_row := old;
  new_row.deleted_at := new.deleted_at;
  if new is distinct from new_row then
    raise exception 'messages: only deleted_at is user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_enforce_soft_delete_only on public.messages;
create trigger messages_enforce_soft_delete_only
  before update on public.messages
  for each row execute function public.enforce_message_soft_delete_only();

drop policy if exists "messages: users soft delete their own" on public.messages;
create policy "messages: users soft delete their own"
  on public.messages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Column-level UPDATE grant is required alongside the policy — Postgres
-- treats UPDATE grants and RLS as complementary. Only deleted_at is
-- grantable; the trigger blocks everything else even if a future grant
-- widens this by accident.
grant update (deleted_at) on public.messages to authenticated;
