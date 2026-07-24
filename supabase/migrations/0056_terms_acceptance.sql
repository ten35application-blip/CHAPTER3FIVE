-- Run via Supabase Studio SQL Editor or `npx supabase db push`.
--
-- 0056: terms acceptance tracking on profiles.
--
-- Users must explicitly accept the current Terms of Service, Privacy
-- Policy, and Community Guidelines before using the app (the
-- /onboarding gate). We record WHEN they accepted and WHICH version
-- (the effective date string, e.g. '2026-07-24'), so a material change
-- to the docs just bumps CURRENT_TERMS_VERSION in
-- src/lib/legal/version.ts and everyone gets re-prompted.
--
-- Existing users deliberately get null here — we cannot retroactively
-- assume acceptance, so they'll see /onboarding on their next visit.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz null,
  add column if not exists terms_version_accepted text null;

comment on column public.profiles.terms_accepted_at is
  'When the user accepted the Terms/Privacy/Guidelines bundle. Null = never accepted.';
comment on column public.profiles.terms_version_accepted is
  'Effective-date version string of the docs the user accepted (e.g. 2026-07-24). Compared against CURRENT_TERMS_VERSION in app code.';

-- RLS: no new policies needed. 0001_initial_schema.sql already gives
-- users select/update/insert on their own profiles row
-- (auth.uid() = id), which covers reading and writing these columns.
