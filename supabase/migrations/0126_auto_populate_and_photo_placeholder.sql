-- ============================================================
-- 0126_auto_populate_and_photo_placeholder
-- ============================================================
-- Phase 3 of the payment-surface work: when a user upgrades to
-- Basic or Pro, the Stripe (or RevenueCat) webhook fires an
-- async task that fills their circle so it's not empty on first
-- open. Wilson's spec:
--
--   Basic ($5/mo) → 2 random companions + 1 photo placeholder = 3 total
--   Pro   ($10/mo) → 4 random companions + 1 photo placeholder = 5 total
--   Free tier      → no change (just Adrian, the concierge)
--
-- Idempotent: a user who cancels and re-subscribes never gets a
-- second dump; the helper counts what's already there and only
-- tops up to the quota gap. Photos flow the same way: exactly
-- one placeholder exists per user post-subscribe, regardless of
-- how many times the webhook fires.
--
-- Two schema additions here:
--
-- 1. oracles.is_photo_placeholder (boolean) — marks a row as a
--    "photo companion" that hasn't been uploaded to yet. Set by
--    the auto-populate helper; cleared by the Phase-4 photo
--    upload route when the user drops a picture in. When true,
--    the dashboard / contact list renders the row differently
--    (soft name, hint copy, no unread badge) and the chat
--    surface disables the composer with an "upload a photo to
--    bring this identity to life" prompt.
--
--    Joins the protect_oracle_columns denylist so a crafted
--    PATCH can't flip is_photo_placeholder=false on a
--    non-populated row and unlock a chat with an empty persona.
--
-- 2. profiles.auto_populate_started_at / auto_populate_completed_at
--    (timestamptz) — the "in flight" signal. The webhook stamps
--    started_at when it acquires the lock and completed_at when
--    the helper finishes. The dashboard reads both to decide
--    whether to render the "your companions are being created"
--    banner (started_at set + completed_at null + started_at
--    recent).
--
--    Both columns are billing-adjacent lifecycle state — NOT in
--    the profiles column allowlist (0116), so authenticated
--    writes are already rejected at the grant layer. No trigger
--    changes needed for the write path.
--
-- 3. try_acquire_auto_populate_lock() — a SECURITY DEFINER RPC
--    that CASes the started_at column so two racing webhook
--    invocations can't both start populating. Stale locks
--    (started > stale_after_seconds ago with no completion) are
--    reclaimable so a crashed run doesn't wedge a user forever.
--
-- Wilson approval flow: this migration file is written but NOT
-- applied. Wilson reviews the SQL, decides on schema, applies
-- manually. Do not run mcp__supabase__apply_migration on this.
--
-- Idempotent. Safe to run twice.

-- ------------------------------------------------------------
-- 1. oracles.is_photo_placeholder
-- ------------------------------------------------------------
alter table public.oracles
  add column if not exists is_photo_placeholder boolean not null default false;

comment on column public.oracles.is_photo_placeholder is
  'True while a photo-companion slot exists but the user has not uploaded a photo yet. Set by the auto-populate helper on subscribe; cleared by the photo-upload route (Phase 4) once the persona is generated from the image.';

-- Grant SELECT so the dashboard SELECT + RLS-scoped queries can
-- read the column (0070 pattern — a table-wide SELECT is not in
-- effect; explicit per-column grants are).
grant select (is_photo_placeholder) on public.oracles to anon, authenticated;

-- Extend protect_oracle_columns (0125) denylist. Users must not
-- flip is_photo_placeholder from the client — legitimate writes
-- come from the auto-populate helper + the photo-upload route,
-- both via the service-role client.
create or replace function public.protect_oracle_columns()
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
    raise exception 'oracles: direct client inserts are not allowed'
      using errcode = '42501';
  end if;

  if new.persona_prompt is distinct from old.persona_prompt
    or new.traits is distinct from old.traits
    or new.fingerprint is distinct from old.fingerprint
    or new.blocked_at is distinct from old.blocked_at
    or new.block_reason is distinct from old.block_reason
    or new.avatar_url is distinct from old.avatar_url
    or new.avatar_hash is distinct from old.avatar_hash
    or new.face_generation_status is distinct from old.face_generation_status
    or new.face_generation_error is distinct from old.face_generation_error
    or new.is_legacy is distinct from old.is_legacy
    or new.creation_source is distinct from old.creation_source
    or new.significant_events is distinct from old.significant_events
    or new.legacy_answers is distinct from old.legacy_answers
    or new.created_by is distinct from old.created_by
    or new.user_id is distinct from old.user_id
    or new.disclosure_pace is distinct from old.disclosure_pace
    or new.silence_style is distinct from old.silence_style
    or new.punctuation_habit is distinct from old.punctuation_habit
    or new.memory_style is distinct from old.memory_style
    or new.text_burst_style is distinct from old.text_burst_style
    or new.voice_examples is distinct from old.voice_examples
    or new.chronotype is distinct from old.chronotype
    or new.texting_fluency is distinct from old.texting_fluency
    or new.pet_name is distinct from old.pet_name
    or new.is_concierge is distinct from old.is_concierge
    or new.is_self_archive is distinct from old.is_self_archive
    or new.is_photo_placeholder is distinct from old.is_photo_placeholder
  then
    raise exception 'oracles: this column is not user-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. profiles.auto_populate_started_at / auto_populate_completed_at
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists auto_populate_started_at timestamptz;

alter table public.profiles
  add column if not exists auto_populate_completed_at timestamptz;

comment on column public.profiles.auto_populate_started_at is
  'Timestamp the subscribe-time auto-populate helper acquired the per-user lock. Cleared each run; combined with auto_populate_completed_at to derive the "your companions are being created" dashboard banner. Not in the profiles column allowlist (0116) — users can neither read nor write. Server-only.';

comment on column public.profiles.auto_populate_completed_at is
  'Timestamp the subscribe-time auto-populate helper finished. When started_at is set and this is null (and started_at is recent), the dashboard renders the "your companions are being created" banner. Server-only per 0116.';

-- Both columns are NOT in the 0116 grant list for authenticated,
-- so PostgREST INSERT / UPDATE from a signed-in user is rejected
-- at the grant layer. Belt: grant SELECT to authenticated so the
-- dashboard can read the state for the banner.
grant select (auto_populate_started_at, auto_populate_completed_at)
  on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3. try_acquire_auto_populate_lock()
-- ------------------------------------------------------------
-- Atomic acquire — the Stripe / RevenueCat webhook calls this
-- before starting the populate. Returns TRUE when the caller
-- got the lock (no other run in flight OR the prior run is
-- stale), FALSE otherwise.
--
-- Stale reclaim (default 5 min) covers the case where a
-- prior populate crashed before writing completed_at — without
-- reclaim, a single crash would wedge a user's populate forever.
-- 5 min chosen because a Basic populate is at most ~60s of
-- Anthropic + Replicate calls; anything older than 5 min is a
-- crashed run, not a live one.

create or replace function public.try_acquire_auto_populate_lock(
  target_user_id uuid,
  stale_after_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  updated_rows integer;
begin
  update public.profiles
    set auto_populate_started_at = now_ts,
        auto_populate_completed_at = null
    where id = target_user_id
      and (
        auto_populate_started_at is null
        or auto_populate_completed_at is not null
        or auto_populate_started_at < now_ts - make_interval(secs => stale_after_seconds)
      );
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

revoke all on function public.try_acquire_auto_populate_lock(uuid, integer)
  from public;
grant execute on function public.try_acquire_auto_populate_lock(uuid, integer)
  to service_role;

comment on function public.try_acquire_auto_populate_lock(uuid, integer) is
  'Attempt to CAS-acquire the per-user auto-populate lock. Returns TRUE on acquire, FALSE when another run holds a non-stale lock. Called by the shared autoPopulate helper from BOTH webhook paths (Stripe + RevenueCat). Stale-after default 5 min so a crashed run does not wedge future retries.';

-- ------------------------------------------------------------
-- 4. mark_auto_populate_complete()
-- ------------------------------------------------------------
-- Small companion RPC so the helper does not need column-write
-- knowledge of the profiles table. Service-role only.

create or replace function public.mark_auto_populate_complete(
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set auto_populate_completed_at = now()
    where id = target_user_id;
end;
$$;

revoke all on function public.mark_auto_populate_complete(uuid) from public;
grant execute on function public.mark_auto_populate_complete(uuid) to service_role;

comment on function public.mark_auto_populate_complete(uuid) is
  'Stamp auto_populate_completed_at = now(). Called by the shared autoPopulate helper on both success AND failure paths so the "companions are being created" banner never lingers forever after a botched run.';
