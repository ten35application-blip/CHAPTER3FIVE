-- 0136_derive_scheduled_purge_at
--
-- The 30-day delete promise was never kept for anyone who deleted on
-- the web.
--
-- 0024 built the grace period out of two columns: deleted_at marks the
-- account as gone, scheduled_purge_at says when to erase it for real.
-- The purge cron (api/cron/purge) selects on
--
--     .lt("scheduled_purge_at", now).not("deleted_at", "is", null)
--
-- and NULL < anything is NULL, not true — so a row whose
-- scheduled_purge_at was never written is invisible to the purge
-- forever. Not delayed. Never.
--
-- Exactly one soft-delete statement in the app wrote that second
-- column: /api/user/delete-account (mobile), on the profile. These
-- did not:
--
--   (gated)/settings/delete/actions.ts   web "delete my account"
--                                        — profile AND their oracles
--   (gated)/dashboard/actions.ts         swipe-delete one identity
--   api/admin/users/[id]/action          admin delete_user
--   api/admin/dev/reset-user             dev reset
--
-- So: delete your account from the website and every message, every
-- answer, and every photo stays in the database and on the avatars
-- bucket — which is PUBLIC — at a permanent unauthenticated URL. The
-- farewell email tells them "every identity you made, every
-- conversation, every photo — it's all been ended." None of it was.
-- Same for a single deleted identity, and same for anything an admin
-- deleted on a user's behalf.
--
-- WHY THE APP COULDN'T HAVE FIXED THIS ITSELF. scheduled_purge_at is
-- deliberately not user-writable: 0116 leaves it out of the profiles
-- column allowlist, and protect_oracle_state (0091/0093/0117) raises
-- 42501 if a PostgREST-role UPDATE changes it on oracles. 0093 says so
-- outright — "that's set by the delete action's server code (via
-- admin)". The rule was written down; the server code never did it.
-- Patching each call site to reach for the admin client would work and
-- would rot the same way, because forgetting one is the bug.
--
-- So the countdown is derived in the database instead. deleted_at is
-- the input, scheduled_purge_at is a function of it, and no caller can
-- forget it — web, mobile, admin, cron, or a hand-written UPDATE in
-- the SQL editor. The column stays server-only; the trigger fills it.
--
-- 30 days matches 0024's grace window and the interval the mobile
-- route already computes in JS. (Verified: the database runs UTC, so
-- `interval '30 days'` is exactly the 30*24*60*60*1000 ms that route
-- adds.)
--
-- ORDER OF DEPLOYMENT: SHIP THE APP FIRST, THEN APPLY THIS.
--
-- The app changes are inert without the trigger — they clear a purge
-- date that nothing sets yet. The trigger without them is not: it
-- starts arming timers on identities that the old restore code has no
-- idea it needs to disarm. Migration-first opens a window where a web
-- account delete is a scheduled loss. App-first opens nothing.
--
-- PAIRED APPLICATION CHANGE — DO NOT APPLY THIS MIGRATION ALONE.
-- settings/delete/actions.ts cascades deleted_at onto every one of the
-- user's oracles purely so the dashboard looks empty during signout
-- ("so nothing lingers on the dashboard mid-signout"). The user did
-- not delete those identities one by one. Both restore paths —
-- stripe/webhook restore_account and the admin undelete action —
-- restore only the PROFILE and leave those oracle rows soft-deleted.
--
-- Today that is survivable precisely BECAUSE of the bug above: the
-- rows carry no purge date, so they sit in Trash indefinitely and the
-- $5 per-identity restore still works whenever the user gets round to
-- it. Give them a purge date without touching anything else and a
-- restored account quietly loses every identity 30 days later —
-- messages, answers, memories, beneficiaries, avatars, all cascaded
-- away. That would be a regression from "immortal" to "destroyed",
-- introduced by the fix.
--
-- So both restore paths now clear scheduled_purge_at on the oracles
-- that went down with the account, matched on the cascade's shared
-- deleted_at stamp so an identity the user genuinely deleted on its
-- own keeps its own countdown. Those rows stay in Trash exactly as
-- they do today; they simply stop being on a timer.

create or replace function public.set_purge_schedule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- INSERT of an already-soft-deleted row (data migration, restore-and-
  -- reinsert, seed). Rare, but it must not create a row that is deleted
  -- and unpurgeable.
  if tg_op = 'INSERT' then
    if new.deleted_at is not null and new.scheduled_purge_at is null then
      new.scheduled_purge_at := new.deleted_at + interval '30 days';
    end if;
    return new;
  end if;

  -- Soft-delete. Start (or restart) the countdown from the delete stamp.
  --
  -- Keyed on deleted_at CHANGING rather than on null -> timestamp, so
  -- that re-deleting an already-soft-deleted row re-bases the countdown
  -- on the new stamp instead of silently keeping the old date and
  -- purging early. Every app delete path now carries an
  -- `.is("deleted_at", null)` guard, so this is unreachable from the
  -- app — but a hand-written UPDATE in the SQL editor or a future
  -- caller without the guard can still re-stamp, and the trigger has
  -- to be correct for them too.
  --
  -- The `is not distinct from` check is what lets an explicit caller
  -- win: /api/user/delete-account computes its own purge date in JS and
  -- writes both columns in one statement, so new.scheduled_purge_at is
  -- distinct from old and this leaves it alone. The one path that was
  -- already correct keeps behaving exactly as it does today.
  if new.deleted_at is not null
     and new.deleted_at is distinct from old.deleted_at
     and new.scheduled_purge_at is not distinct from old.scheduled_purge_at then
    new.scheduled_purge_at := new.deleted_at + interval '30 days';
  end if;

  -- Restore: timestamp -> null. Cancel the countdown.
  --
  -- Unconditional, deliberately asymmetric with the delete branch above
  -- (which yields to a caller-supplied value). A live row has no
  -- business carrying a purge date under any circumstances, so there is
  -- no caller value worth honouring here. This also repairs the admin
  -- undelete action, which clears profiles.deleted_at and nothing else.
  if old.deleted_at is not null and new.deleted_at is null then
    new.scheduled_purge_at := null;
  end if;

  return new;
end;
$$;

-- Matches the posture 0134 established for the other internal
-- trigger functions: nothing in an exposed API role should hold
-- EXECUTE on this. plpgsql refuses direct invocation of a trigger
-- function anyway, so this is belt-and-suspenders, not a fix.
revoke all on function public.set_purge_schedule() from public;
revoke all on function public.set_purge_schedule() from anon;
revoke all on function public.set_purge_schedule() from authenticated;

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
-- Existing BEFORE triggers here are profiles_protect_billing (0065,
-- body since replaced by 0118) and profiles_touch_updated_at (0001).
-- protect_billing does not name scheduled_purge_at, and its deleted_at
-- guard blocks only timestamp -> null for PostgREST roles, which this
-- trigger never produces. So ordering against them is immaterial on
-- this table.
drop trigger if exists profiles_set_purge_schedule on public.profiles;
create trigger profiles_set_purge_schedule
  before insert or update on public.profiles
  for each row execute function public.set_purge_schedule();

-- ---------------------------------------------------------------
-- oracles
-- ---------------------------------------------------------------
-- TRIGGER NAME IS LOAD-BEARING. Postgres fires BEFORE row triggers in
-- alphabetical order by trigger name, and oracles already carries
-- oracles_protect_state, which raises 42501 when a PostgREST-role
-- UPDATE leaves new.scheduled_purge_at distinct from old.
--
--   oracles_protect_state  <  oracles_set_purge_schedule   ('p' < 's')
--
-- so the guard evaluates the caller's own row FIRST and passes (the
-- user never touched the column), and only then does this trigger
-- derive the value. Rename this trigger to anything sorting before
-- "oracles_protect_state" and every user-side identity delete starts
-- failing with "oracles: state columns are not user-writable".
--
-- Ordering verified by reading pg_trigger on the live table rather
-- than by experiment: the BEFORE triggers are
-- oracles_protect_backend_columns, oracles_protect_state and
-- oracles_touch_updated_at, so this one sorts after both guards and
-- before the touch. Trigger name comparison is bytewise, so
-- 'p' < 's' < 't' is unambiguous.
drop trigger if exists oracles_set_purge_schedule on public.oracles;
create trigger oracles_set_purge_schedule
  before insert or update on public.oracles
  for each row execute function public.set_purge_schedule();

-- ---------------------------------------------------------------
-- Backfill: rows already soft-deleted with no countdown.
-- ---------------------------------------------------------------
-- Verified against production while writing this: zero rows in either
-- table are soft-deleted at all, so today this is a no-op. It exists
-- for rows that appear between writing and applying.
--
-- The floor is the point. Without it, a row soft-deleted more than 30
-- days ago backfills to a date in the PAST and is hard-deleted on the
-- very next cron run — no grace, no warning, while the Trash UI is
-- still offering a $5 restore for it. Nobody has ever been through
-- this purge path successfully, so the first real run deserves a week
-- in which a human can still look at what it is about to destroy.
--
-- The floor applies to anything whose natural date lands inside the
-- next 7 days, so a row deleted 25 days ago gets 7 more rather than 5.
-- Erring long, once, on the run that has never happened before.
--
-- Idempotent: the where clause excludes anything already scheduled.
update public.profiles
   set scheduled_purge_at = greatest(
         deleted_at + interval '30 days',
         now() + interval '7 days'
       )
 where deleted_at is not null
   and scheduled_purge_at is null;

update public.oracles
   set scheduled_purge_at = greatest(
         deleted_at + interval '30 days',
         now() + interval '7 days'
       )
 where deleted_at is not null
   and scheduled_purge_at is null;
