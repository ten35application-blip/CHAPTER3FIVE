-- Align the column guards with the billing guard: identify the client roles
-- directly instead of enumerating server roles, so non-PostgREST connections
-- (migrations, maintenance) behave the same as other server-side writes.

create or replace function public.protect_oracle_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon')
     and coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'oracles: direct client inserts are not allowed'
      using errcode = '42501';
  end if;

  if new.persona_prompt is distinct from old.persona_prompt
    or new.traits is distinct from old.traits
    or new.fingerprint is distinct from old.fingerprint
    or new.blocked_at is distinct from old.blocked_at
    or new.block_reason is distinct from old.block_reason
    or new.avatar_url is distinct from old.avatar_url
    or new.avatar_hash is distinct from old.avatar_hash
    or new.face_generation_status is distinct from old.face_generation_status
    or new.face_generation_error is distinct from old.face_generation_error
    or new.is_legacy is distinct from old.is_legacy
    or new.creation_source is distinct from old.creation_source
    or new.significant_events is distinct from old.significant_events
    or new.legacy_answers is distinct from old.legacy_answers
    or new.created_by is distinct from old.created_by
    or new.user_id is distinct from old.user_id
  then
    raise exception 'oracles: this column is not user-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

create or replace function public.protect_inherit_code_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon')
     and coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'inherit_codes: direct client inserts are not allowed'
      using errcode = '42501';
  end if;

  if new.code is distinct from old.code
    or new.oracle_id is distinct from old.oracle_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'inherit_codes: this column is not user-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
