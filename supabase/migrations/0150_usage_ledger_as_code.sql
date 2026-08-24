-- The paid-usage ledger existed ONLY in production (self-audit
-- 2026-08-25) — billing_period_start, monthly_usage, bump_monthly_usage,
-- tg_bump_monthly_usage, and current_usage were applied live on
-- 2026-08-22 but never recorded here. Any environment rebuilt from
-- migrations lost the ledger: current_usage errored, the reader fell
-- back to counting messages rows, and "Delete forever" refunded usage —
-- the exact loop the ledger was built to close. Definitions below are
-- verbatim dumps from production (pg_get_functiondef). Idempotent.

create table if not exists public.monthly_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period date not null,
  messages integer not null default 0,
  images integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);
alter table public.monthly_usage enable row level security;
revoke all on public.monthly_usage from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.billing_period_start(target_user_id uuid)
 RETURNS date
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  anchor      timestamptz;
  anchor_day  int;
  today       date := (now() at time zone 'utc')::date;
  m           date;
  days_in_m   int;
  candidate   date;
begin
  select coalesce(p.pro_until, p.trial_ends_at, p.created_at)
    into anchor
  from public.profiles p
  where p.id = target_user_id;

  if anchor is null then
    return date_trunc('month', today)::date;
  end if;

  anchor_day := extract(day from (anchor at time zone 'utc'))::int;

  m         := date_trunc('month', today)::date;
  days_in_m := extract(day from (m + interval '1 month' - interval '1 day'))::int;
  candidate := m + (least(anchor_day, days_in_m) - 1);

  if candidate > today then
    m         := (date_trunc('month', today) - interval '1 month')::date;
    days_in_m := extract(day from (m + interval '1 month' - interval '1 day'))::int;
    candidate := m + (least(anchor_day, days_in_m) - 1);
  end if;

  return candidate;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bump_monthly_usage(target_user_id uuid, kind text DEFAULT 'message'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  new_count int;
  p date := public.billing_period_start(target_user_id);
begin
  insert into public.monthly_usage (user_id, period, messages, images, updated_at)
  values (
    target_user_id, p,
    case when kind = 'image' then 0 else 1 end,
    case when kind = 'image' then 1 else 0 end,
    now()
  )
  on conflict (user_id, period) do update
    set messages = public.monthly_usage.messages
                   + (case when kind = 'image' then 0 else 1 end),
        images   = public.monthly_usage.images
                   + (case when kind = 'image' then 1 else 0 end),
        updated_at = now()
  returning (case when kind = 'image' then images else messages end)
  into new_count;
  return new_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tg_bump_monthly_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  is_exempt boolean;
begin
  if new.role is distinct from 'user' then
    return new;
  end if;

  select coalesce(o.is_self_archive, false) or o.mode = 'help'
    into is_exempt
  from public.oracles o
  where o.id = new.oracle_id
    and o.user_id = new.user_id;

  if coalesce(is_exempt, false) then
    return new;
  end if;

  perform public.bump_monthly_usage(new.user_id, 'message');

  if new.image_storage_path is not null then
    perform public.bump_monthly_usage(new.user_id, 'image');
  end if;

  return new;
exception when others then
  return new;
end;
$function$;

drop trigger if exists messages_bump_monthly_usage on public.messages;
create trigger messages_bump_monthly_usage
  after insert on public.messages
  for each row execute function public.tg_bump_monthly_usage();

CREATE OR REPLACE FUNCTION public.current_usage(target_user_id uuid)
 RETURNS TABLE(period_start date, messages integer, images integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    public.billing_period_start(target_user_id) as period_start,
    coalesce(mu.messages, 0)                    as messages,
    coalesce(mu.images, 0)                      as images
  from (select 1) _
  left join public.monthly_usage mu
    on mu.user_id = target_user_id
   and mu.period  = public.billing_period_start(target_user_id);
$function$;

revoke execute on function public.bump_monthly_usage(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.billing_period_start(uuid)
  from public, anon;
revoke execute on function public.current_usage(uuid)
  from public, anon;
