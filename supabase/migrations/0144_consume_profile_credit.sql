-- 0144_consume_profile_credit
--
-- ONE STATEMENT FOR THE CHECK AND THE SPEND.
--
-- Every paid one-time credit was check-then-consume with the two halves
-- far apart: read the balance at the gate, decrement after the thing it
-- paid for had persisted. On the inherit path that is 191 lines, a
-- Stripe branch, a storage copy and an insert. Two redemptions fired at
-- the same second both read 1, both wrote their archive, and the second
-- decrement floored at 0 because increment_profile_counter uses
-- greatest(0, coalesce(col,0) + delta). One $5 credit, two $5 archives,
-- repeatable on purpose from two tabs or two devices. The fingerprint
-- unique index does not cover it: two DIFFERENT codes produce two
-- different fingerprints and both insert cleanly.
--
-- consume_profile_credit does the check and the decrement in a single
-- UPDATE ... WHERE credits > 0 RETURNING. Postgres serialises the two
-- concurrent updates of the same profiles row, so exactly one caller
-- sees a returned row; the loser gets false and must not proceed.
--
-- Same shape and same posture as bump_chat_usage and
-- increment_profile_counter: SECURITY DEFINER, empty search_path,
-- allowlisted counter names, EXECUTE for service_role only (0134).
-- The allowlist is copied verbatim from increment_profile_counter so a
-- typo'd counter raises instead of silently writing nothing and reading
-- as "no credit".
--
-- This function only ever SPENDS. Granting stays increment_profile_counter's
-- job, and so do refunds: a claim whose write then failed goes back with
-- delta +1 through increment_profile_counter.
--
-- Idempotent. Safe to run twice. Adds nothing, drops nothing, and
-- changes no existing function or row.

create or replace function public.consume_profile_credit(
  target_user_id uuid,
  counter_name text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  claimed int;
begin
  if counter_name not in (
    'randomize_credits',
    'extra_oracle_credits',
    'paid_beneficiary_slots',
    'message_credits',
    'image_credits',
    'inherited_slot_credits',
    'other_identity_credits'
  ) then
    raise exception 'invalid counter %', counter_name;
  end if;

  execute format(
    'update public.profiles set %I = %I - 1 where id = $1 and coalesce(%I, 0) > 0 returning 1',
    counter_name, counter_name, counter_name
  )
  into claimed
  using target_user_id;

  -- No row updated => no credit was available => the caller gets
  -- nothing. Never a silent success.
  return claimed is not null;
end;
$$;

revoke execute on function public.consume_profile_credit(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_profile_credit(uuid, text)
  to service_role;