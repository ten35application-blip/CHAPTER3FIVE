-- Plan codes (2026-09-10): a code Wilson hands out that puts an account
-- on Pro for a month, a year, or forever, for a set number of accounts.
-- Server-only tables (RLS on, no policies); redemption is one atomic RPC.
-- No codes are created here — Wilson mints them when he says so.
create table if not exists public.plan_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  grant_kind text not null check (grant_kind in ('pro_month','pro_year','pro_forever')),
  max_uses integer not null check (max_uses > 0),
  uses integer not null default 0,
  enabled boolean not null default true,
  expires_at timestamptz,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.plan_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.plan_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_kind text not null,
  pro_until_after timestamptz,
  created_at timestamptz not null default now(),
  unique (code_id, user_id)
);
alter table public.plan_codes enable row level security;
alter table public.plan_code_redemptions enable row level security;
revoke all on public.plan_codes from anon, authenticated;
revoke all on public.plan_code_redemptions from anon, authenticated;

create or replace function public.redeem_plan_code(p_user_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.plan_codes%rowtype; cur timestamptz; base timestamptz; new_until timestamptz;
begin
  select * into c from public.plan_codes where upper(code) = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if not c.enabled then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if c.expires_at is not null and c.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if exists (select 1 from public.plan_code_redemptions r where r.code_id = c.id and r.user_id = p_user_id) then return jsonb_build_object('ok', false, 'error', 'already_redeemed'); end if;
  if c.uses >= c.max_uses then return jsonb_build_object('ok', false, 'error', 'used_up'); end if;
  select pro_until into cur from public.profiles where id = p_user_id;
  base := greatest(now(), coalesce(cur, now()));
  new_until := case c.grant_kind when 'pro_month' then base + interval '30 days' when 'pro_year' then base + interval '365 days' else timestamptz '2099-12-31 00:00:00+00' end;
  update public.profiles set pro_until = new_until, subscription_tier = 'pro', plan_source = 'code' where id = p_user_id;
  insert into public.plan_code_redemptions (code_id, user_id, grant_kind, pro_until_after) values (c.id, p_user_id, c.grant_kind, new_until);
  update public.plan_codes set uses = uses + 1 where id = c.id;
  return jsonb_build_object('ok', true, 'grant', c.grant_kind, 'pro_until', new_until);
end; $$;
revoke all on function public.redeem_plan_code(uuid, text) from public, anon, authenticated;

-- plan_source gains 'code' so a redeemed plan code can be told apart
-- from Stripe, the stores, a trial, or an admin grant.
alter table public.profiles drop constraint if exists profiles_plan_source_check;
alter table public.profiles add constraint profiles_plan_source_check check (plan_source = any (array['stripe'::text, 'admin_grant'::text, 'none'::text, 'trial'::text, 'iap'::text, 'code'::text]));
