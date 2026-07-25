-- ============================================================================
-- 0063_pro_flag.sql
--
-- Applied to live DB via MCP on 2026-07-25. Committing the file so a
-- fresh environment can `supabase db push` and get the same shape.
--
-- Adds the minimal Pro-plan mechanism used by src/lib/subscription.ts:
--   - profiles.pro_until: nullable timestamptz. In-future = Pro.
--       Written by the Stripe webhook (once checkout is fully wired
--       end-to-end) and by the admin "Grant Pro (30 days)" tool at
--       /admin/users/[id].
--   - profiles.plan_source: enum tag for audit trail. 'stripe' vs
--       'admin_grant' vs 'none'. Not used by isPro() — that reads
--       pro_until alone — but a support-facing signal for debugging
--       "why does this user have Pro?".
--
-- No separate subscriptions table for MVP. If Stripe billing grows
-- into needing invoice history, seat counts, etc., a real
-- stripe_subscriptions table can shadow this without breaking the
-- helper (isPro just needs to keep returning the right boolean).
--
-- Idempotent. Safe to run twice.
-- ============================================================================

alter table public.profiles
  add column if not exists pro_until timestamptz null,
  add column if not exists plan_source text
    check (plan_source in ('stripe', 'admin_grant', 'none'))
    default 'none';

comment on column public.profiles.pro_until is
  'When the user''s Pro access expires (or NULL for never-Pro / expired).';
comment on column public.profiles.plan_source is
  'How the current Pro window was granted. Audit trail for future support.';

create index if not exists profiles_pro_until_idx
  on public.profiles (pro_until)
  where pro_until is not null;
