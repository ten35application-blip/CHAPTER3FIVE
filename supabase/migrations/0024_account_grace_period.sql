-- chapter3five — 30-day soft-delete grace period for accounts.
--
-- Deleting an account no longer hard-purges immediately. Instead it
-- marks the profile as deleted and schedules a purge 30 days out. During
-- the grace window the user can sign back in, see they're "in trash,"
-- and pay $5 to restore. After 30 days a cron does the irrevocable
-- cleanup (auth.users delete, storage cleanup, every owned row).
--
-- Rationale: chapter3five data is high emotional stakes. Someone deletes
-- in grief on a Sunday night and wakes up regretting it Monday — we want
-- that to be recoverable, not a permanent mistake.

alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists scheduled_purge_at timestamptz;

-- Same grace pattern at the oracle level — deleting one specific
-- thirtyfive among several should also be recoverable for 30 days.
alter table public.oracles
  add column if not exists deleted_at timestamptz,
  add column if not exists scheduled_purge_at timestamptz;

-- Indexes so the purge cron + skip-deleted filters stay cheap.
create index if not exists profiles_deleted_at_idx
  on public.profiles (deleted_at)
  where deleted_at is not null;
create index if not exists profiles_scheduled_purge_at_idx
  on public.profiles (scheduled_purge_at)
  where scheduled_purge_at is not null;
create index if not exists oracles_deleted_at_idx
  on public.oracles (deleted_at)
  where deleted_at is not null;
create index if not exists oracles_scheduled_purge_at_idx
  on public.oracles (scheduled_purge_at)
  where scheduled_purge_at is not null;
