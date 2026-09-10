-- Plan codes grant Basic too (Wilson 2026-09-10: "codes will not be
-- specific… free for a month, for a year, basic for a month or a year").
-- grant_kind = <basic|pro>_<month|year|forever>; the tier comes from the
-- code, the box in Settings just takes a code.
alter table public.plan_codes drop constraint if exists plan_codes_grant_kind_check;
alter table public.plan_codes add constraint plan_codes_grant_kind_check check (grant_kind in ('basic_month','basic_year','basic_forever','pro_month','pro_year','pro_forever'));

create or replace function public.redeem_plan_code(p_user_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.plan_codes%rowtype; cur timestamptz; base timestamptz; new_until timestamptz; tier text; span text;
begin
  select * into c from public.plan_codes where upper(code) = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if not c.enabled then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if c.expires_at is not null and c.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if exists (select 1 from public.plan_code_redemptions r where r.code_id = c.id and r.user_id = p_user_id) then return jsonb_build_object('ok', false, 'error', 'already_redeemed'); end if;
  if c.uses >= c.max_uses then return jsonb_build_object('ok', false, 'error', 'used_up'); end if;
  tier := split_part(c.grant_kind, '_', 1); span := split_part(c.grant_kind, '_', 2);
  select pro_until into cur from public.profiles where id = p_user_id;
  base := greatest(now(), coalesce(cur, now()));
  new_until := case span when 'month' then base + interval '30 days' when 'year' then base + interval '365 days' else timestamptz '2099-12-31 00:00:00+00' end;
  update public.profiles set pro_until = new_until, subscription_tier = tier, plan_source = 'code' where id = p_user_id;
  insert into public.plan_code_redemptions (code_id, user_id, grant_kind, pro_until_after) values (c.id, p_user_id, c.grant_kind, new_until);
  update public.plan_codes set uses = uses + 1 where id = c.id;
  return jsonb_build_object('ok', true, 'grant', c.grant_kind, 'tier', tier, 'pro_until', new_until);
end; $$;
revoke all on function public.redeem_plan_code(uuid, text) from public, anon, authenticated;
