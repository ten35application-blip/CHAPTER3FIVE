-- 0073: paid extra inherited-identity slots.
--
-- Pro includes ONE inherited identity (redeeming someone else's inherit
-- code). Each additional inherited identity is $5/month, tracked as a
-- count of purchased slots on the profile. The column is an entitlement,
-- so it joins the billing-column guard: only service-role paths (admin
-- grant tool, future Stripe webhook) may change it.
--
-- NOTE: this migration was applied to the live DB before landing in the
-- repo, so every statement is idempotent — a re-run is a no-op.

alter table public.profiles
  add column if not exists extra_inherited_slots integer not null default 0
    check (extra_inherited_slots >= 0);

comment on column public.profiles.extra_inherited_slots is
  'Number of paid extra inherited-identity slots on top of the one included with Pro. Guarded — service-role writes only.';

create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller text := current_user::text;
begin
  if caller in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  if new.pro_until is distinct from old.pro_until
    or new.plan_source is distinct from old.plan_source
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.free_identity_id is distinct from old.free_identity_id
    or new.extra_inherited_slots is distinct from old.extra_inherited_slots
  then
    raise exception 'profiles: billing / entitlement columns are not user-writable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
