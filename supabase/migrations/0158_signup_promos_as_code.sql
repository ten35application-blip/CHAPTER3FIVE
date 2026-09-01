-- SIGNUP PROMOS — the schema as code (audit 2026-09-01).
-- Applied to the live DB 2026-09-01 via the management API before it
-- was committed here; this file makes the repo the source of truth
-- again and rebuilds the feature in any fresh environment. Idempotent.
create table if not exists public.signup_promos (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  kind text not null check (kind in
    ('companion','pro_month','message_pack','image_pack','inherit_credit')),
  quota integer not null check (quota > 0),
  claimed integer not null default 0 check (claimed >= 0),
  enabled boolean not null default false,
  starts_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.signup_promos enable row level security;
-- No policies on purpose: server-only via service role.

alter table public.admin_gifts
  add column if not exists promo_id uuid references public.signup_promos(id) on delete set null;

create unique index if not exists admin_gifts_one_per_promo
  on public.admin_gifts (user_id, promo_id) where promo_id is not null;

create unique index if not exists signup_promos_one_enabled
  on public.signup_promos ((enabled)) where enabled;

create or replace function public.claim_signup_promo(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  promo record;
  joined timestamptz;
begin
  select created_at into joined
  from public.profiles where id = target_user_id;
  if joined is null then return null; end if;

  -- Atomic: the WHERE claimed < quota inside the UPDATE serialises
  -- concurrent claimants on the row lock; the loser matches no row.
  update public.signup_promos p
     set claimed = p.claimed + 1
   where p.enabled
     and p.claimed < p.quota
     and joined >= p.starts_at
     and not exists (
       select 1 from public.admin_gifts g
        where g.user_id = target_user_id and g.promo_id = p.id
     )
  returning p.id, p.kind into promo;

  if promo.id is null then return null; end if;

  insert into public.admin_gifts (user_id, kind, promo_id, note)
  values (target_user_id, promo.kind, promo.id, 'signup promo')
  on conflict (user_id, promo_id) where promo_id is not null
  do nothing;

  return promo.kind;
end;
$$;

-- Locked to the server. Verified live 2026-09-01: only postgres +
-- service_role hold EXECUTE (the blanket revoke initially stripped
-- service_role too — the re-grant below is REQUIRED, not optional).
revoke execute on function public.claim_signup_promo(uuid) from public, anon, authenticated;
grant execute on function public.claim_signup_promo(uuid) to service_role;
