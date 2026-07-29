-- 0122_iap_entitlements
--
-- Apple / Google in-app purchase entitlements, mirrored from
-- RevenueCat. One row per (user, entitlement): e.g. ("<uid>", "pro").
--
-- Write path (the ONLY write path):
--
--   device purchase → RevenueCat validates the receipt →
--   RevenueCat webhook → POST /api/webhooks/revenuecat (web repo)
--   → service-role upsert here.
--
-- Clients NEVER write this table. Mobile checks entitlement state
-- against RevenueCat's own SDK cache (Purchases.getCustomerInfo);
-- this table is the server-side source of truth so API routes and
-- web surfaces can gate features without calling RevenueCat.
--
-- app_user_id in RevenueCat == the Supabase auth.users id (mobile
-- passes it at Purchases.configure time), which is what keys the
-- webhook upsert to user_id here.
--
-- expires_at semantics:
--   NULL           → lifetime / non-expiring (one-time packs)
--   future         → active subscription
--   past           → lapsed (kept for history; is_entitled() = false)
--
-- Security posture: user-reachable table, so RLS + column allowlist
-- (house rule). Users get SELECT-own only; all mutation grants are
-- revoked from anon/authenticated and granted to service_role
-- explicitly for the webhook.
--
-- Idempotent. Safe to run twice.

create table if not exists public.iap_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_id text not null,
  product_id text not null,
  expires_at timestamptz,
  platform text not null check (platform in ('ios', 'android', 'web')),
  revenuecat_user_id text,
  original_transaction_id text unique,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, entitlement_id)
);

alter table public.iap_entitlements enable row level security;

-- SELECT-own is the only user-facing verb. No insert/update/delete
-- policies exist on purpose: even if a grant slipped through, RLS
-- would still block client writes.
drop policy if exists iap_entitlements_select_own on public.iap_entitlements;
create policy iap_entitlements_select_own
  on public.iap_entitlements for select
  using (auth.uid() = user_id);

revoke all on public.iap_entitlements from anon;
revoke all on public.iap_entitlements from authenticated;

grant select (
  user_id,
  entitlement_id,
  product_id,
  expires_at,
  platform,
  revenuecat_user_id,
  original_transaction_id,
  updated_at,
  created_at
) on public.iap_entitlements to authenticated;

-- service_role bypasses RLS, but the explicit grant documents the
-- webhook's write path and survives any future default-privilege
-- tightening.
grant select, insert, update, delete
  on public.iap_entitlements to service_role;

-- The one question the rest of the app asks: "is this user entitled
-- to X right now?" SECURITY DEFINER so callers don't need broader
-- table access than SELECT-own; pinned search_path per house rule.
create or replace function public.is_entitled(uid uuid, ent_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.iap_entitlements e
    where e.user_id = uid
      and e.entitlement_id = ent_id
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

revoke all on function public.is_entitled(uuid, text) from public;
grant execute on function public.is_entitled(uuid, text) to authenticated;
grant execute on function public.is_entitled(uuid, text) to service_role;

comment on table public.iap_entitlements is
  'Apple/Google IAP entitlements mirrored from RevenueCat. Written ONLY by the RevenueCat webhook (/api/webhooks/revenuecat, service role). Clients read their own rows; feature gates call is_entitled(). expires_at NULL = lifetime.';

comment on policy iap_entitlements_select_own on public.iap_entitlements is
  'Users read their own entitlement rows. No client-side write policies exist: RevenueCat webhook (service role) is the sole writer.';

comment on function public.is_entitled(uuid, text) is
  'TRUE when (uid, ent_id) has a row that is non-expiring or not yet expired. The canonical "is this user Pro" check for API routes and RLS-adjacent gates.';
