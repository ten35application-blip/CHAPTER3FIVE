-- chapter3five — atomic beneficiary insert.
--
-- The web actions addBeneficiary and addFamilyMember count the
-- user's current beneficiaries, compare to (3 free + paid_slots),
-- and insert a new row. Two concurrent requests can both pass the
-- count check, then both insert, exceeding the cap.
--
-- This RPC does the check + insert inside a single transaction so
-- the second concurrent call sees the row from the first and
-- bails. Callers should switch from the inline pattern to this
-- function.

create or replace function public.add_beneficiary_atomic(
  p_owner_user_id uuid,
  p_email text,
  p_name text,
  p_claim_token text
)
returns table (
  id uuid,
  status text,
  was_inserted boolean,
  over_cap boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  free_cap constant int := 3;
  current_count int;
  paid_extra int;
  total_cap int;
  existing_row record;
  new_row record;
begin
  -- Lock the profile row so concurrent adds serialize.
  select coalesce(paid_beneficiary_slots, 0)
    into paid_extra
    from public.profiles
    where id = p_owner_user_id
    for update;

  if not found then
    return query select null::uuid, null::text, false, false;
    return;
  end if;

  total_cap := free_cap + paid_extra;

  -- If this email already has a non-removed row for this owner,
  -- return it idempotently (don't double-insert).
  select b.id, b.status
    into existing_row
    from public.beneficiaries b
    where b.owner_user_id = p_owner_user_id
      and lower(b.email) = lower(p_email)
      and b.status <> 'removed';
  if existing_row.id is not null then
    return query select existing_row.id, existing_row.status, false, false;
    return;
  end if;

  -- Count non-removed beneficiaries holding a slot.
  select count(*) into current_count
    from public.beneficiaries
    where owner_user_id = p_owner_user_id
      and status <> 'removed';

  if current_count >= total_cap then
    return query select null::uuid, null::text, false, true;
    return;
  end if;

  insert into public.beneficiaries (
    owner_user_id, email, name, claim_token
  )
  values (p_owner_user_id, p_email, p_name, p_claim_token)
  returning beneficiaries.id, beneficiaries.status into new_row;

  return query select new_row.id, new_row.status, true, false;
end;
$$;

revoke all on function public.add_beneficiary_atomic(uuid, text, text, text) from public;
grant execute on function public.add_beneficiary_atomic(uuid, text, text, text) to authenticated;
